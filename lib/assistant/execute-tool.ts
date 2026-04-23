import "server-only";

import { listMemos, searchMemos } from "@/lib/memos";
import { logAssistantToolBlocked, logAssistantToolInvoked } from "@/lib/logging/audit-log";
import { detectSensitiveContent } from "@/lib/safety";

import { getWeatherAdapter } from "./adapters/weather";
import { getWebSearchAdapter } from "./adapters/web-search";
import {
  GetRecentMemosArgs,
  GetWeatherArgs,
  ProposeSaveMemoArgs,
  SearchMemosArgs,
  SearchWebArgs,
  TOOL_TIERS,
  type ToolName,
} from "./tools";
import type { AssistantRunContext, ToolResult } from "./types";

/**
 * 모델이 호출한 단일 function_call 을 실행한다.
 *
 * 책임:
 *  - 이름이 화이트리스트(ToolName)에 들어 있는지 확인. 아니면 blocked 반환.
 *  - Zod 로 인자 검증. 실패 시 error 반환.
 *  - 티어(read/proposal/restricted) 에 따른 실행 분기.
 *  - 모든 호출을 감사 로그에 기록.
 *  - DB write 는 직접 하지 않는다. 쓰기 계열은 pending_action 생성까지만 가는 `propose_save_memo` 뿐이다.
 */
export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: AssistantRunContext,
): Promise<ToolResult> {
  if (!isKnownTool(name)) {
    await logAssistantToolBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      tool_name: name,
      reason: "unknown_tool",
    });
    return { kind: "blocked", name, reason: "unknown_tool" };
  }

  const tier = TOOL_TIERS[name];
  if (tier === "restricted") {
    // 현재 카탈로그에 restricted 는 없다. 방어선으로 둔다.
    await logAssistantToolBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      tool_name: name,
      reason: "restricted_tier",
    });
    return { kind: "blocked", name, reason: "restricted_tier" };
  }

  await logAssistantToolInvoked({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    tool_name: name,
    tier,
    session_id: ctx.session_id ?? null,
  });

  switch (name) {
    case "search_memos":
      return runSearchMemos(rawArgs);
    case "get_recent_memos":
      return runGetRecentMemos(rawArgs);
    case "get_weather":
      return runGetWeather(rawArgs);
    case "search_web":
      return runSearchWeb(rawArgs);
    case "propose_save_memo":
      return runProposeSaveMemo(rawArgs, ctx);
    default: {
      const exhaustive: never = name;
      return { kind: "error", name: exhaustive, reason: "unreachable" };
    }
  }
}

function isKnownTool(name: string): name is ToolName {
  return name in TOOL_TIERS;
}

// ─────────────────────────────────────────────────────────────────────────────
// read tools
// ─────────────────────────────────────────────────────────────────────────────

async function runSearchMemos(raw: unknown): Promise<ToolResult> {
  const parsed = SearchMemosArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "search_memos", reason: "invalid_arguments" };
  }
  const result = await searchMemos({
    query: parsed.data.query,
    limit: parsed.data.limit,
  });
  return {
    kind: "data",
    name: "search_memos",
    payload: {
      query: result.query,
      count: result.items.length,
      items: result.items.map(projectMemoForModel),
    },
  };
}

async function runGetRecentMemos(raw: unknown): Promise<ToolResult> {
  const parsed = GetRecentMemosArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "get_recent_memos", reason: "invalid_arguments" };
  }
  const result = await listMemos({
    limit: parsed.data.limit,
    project_key: parsed.data.project_key ?? null,
  });
  return {
    kind: "data",
    name: "get_recent_memos",
    payload: {
      count: result.items.length,
      items: result.items.map(projectMemoForModel),
    },
  };
}

async function runGetWeather(raw: unknown): Promise<ToolResult> {
  const parsed = GetWeatherArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "get_weather", reason: "invalid_arguments" };
  }
  const adapter = getWeatherAdapter();
  const result = await adapter.fetch({ location: parsed.data.location ?? null });
  return { kind: "data", name: "get_weather", payload: result };
}

async function runSearchWeb(raw: unknown): Promise<ToolResult> {
  const parsed = SearchWebArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "search_web", reason: "invalid_arguments" };
  }
  const adapter = getWebSearchAdapter();
  const result = await adapter.search({
    query: parsed.data.query,
    limit: parsed.data.limit,
  });
  // 외부 검색 결과는 untrusted 데이터다.
  // 현재 공급자 미설정 상태(`not_configured`)여서 추가 safety 처리가 필요 없지만,
  // 실제 공급자 붙이는 시점에 이 지점에서 `lib/safety.prepareUntrusted` 통과를 강제한다.
  return { kind: "data", name: "search_web", payload: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// proposal tool (read-first 단계에서는 pending_action 을 만들지 않는다)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * propose_save_memo — proposal-only.
 *
 * 이번 단계 정책:
 *  - 절대 DB 에 쓰지 않는다. pending_actions 도 만들지 않는다.
 *  - "이러이러한 내용으로 저장안을 만들 수 있습니다" 라는 구조화된 미리보기만 반환한다.
 *  - 모델은 이 결과를 받아서 사용자에게 "저장하시려면 메모 저장 UI 에서 확인해 주세요" 라고 안내한다.
 *  - 실제 pending_action 생성은 사용자가 UI(/memos Quick Capture) 에서 명시적으로 수행한다.
 */
async function runProposeSaveMemo(
  raw: unknown,
  _ctx: AssistantRunContext,
): Promise<ToolResult> {
  const parsed = ProposeSaveMemoArgs.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: "error",
      name: "propose_save_memo",
      reason: "invalid_arguments",
    };
  }

  const content = parsed.data.content;
  const sensitivityMatches = detectSensitiveContent(content);

  return {
    kind: "data",
    name: "propose_save_memo",
    payload: {
      kind: "proposal_preview",
      would_save: false,
      title: parsed.data.title ?? null,
      project_key: parsed.data.project_key ?? null,
      content_preview: content.trim().slice(0, 200),
      content_length: content.length,
      sensitivity_flag: sensitivityMatches.length > 0,
      sensitivity_categories: sensitivityMatches.map((m) => m.category),
      // 모델에게 보내는 가이드: 저장은 사용자가 UI 에서 명시적으로 해야 한다.
      note: "This is a proposal preview only. No pending_action was created. The user must confirm via the memo UI.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

type MemoProjection = {
  id: string;
  title: string | null;
  preview: string;
  project_key: string | null;
  sensitivity_flag: boolean;
  created_at: string;
};

function projectMemoForModel(memo: {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  project_key: string | null;
  sensitivity_flag: boolean;
  created_at: string;
}): MemoProjection {
  // 모델 컨텍스트를 아끼기 위해 원문 대신 summary(있으면) 또는 200자 미리보기만 넘긴다.
  const preview = (memo.summary ?? memo.content).trim().slice(0, 200);
  return {
    id: memo.id,
    title: memo.title,
    preview,
    project_key: memo.project_key,
    sensitivity_flag: memo.sensitivity_flag,
    created_at: memo.created_at,
  };
}
