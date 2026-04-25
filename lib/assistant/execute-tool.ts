import "server-only";

import { analyzeDocument } from "@/lib/documents/analyze-document";
import { compareDocuments } from "@/lib/documents/compare-documents";
import { getDocumentDetail } from "@/lib/documents/get-document";
import { listDocuments } from "@/lib/documents/list-documents";
import { createMemoDraft, listMemos, searchMemos } from "@/lib/memos";
import { normalizeMemoTagList } from "@/lib/memos/tag-input";
import { ASSISTANT_MEMO_MODEL_PREVIEW_MAX_CHARS } from "@/types/memos";
import { createClient } from "@/lib/supabase/server";
import type { DocumentDetailPayload, DocumentListItemPayload } from "@/types/document";
import {
  logAssistantPendingActionCreated,
  logAssistantProposalGenerated,
  logAssistantSaveIntentBlocked,
  logAssistantToolBlocked,
  logAssistantToolInvoked,
} from "@/lib/logging/audit-log";
import { evaluateSaveMemoIntent } from "@/lib/policies/assistant";
import { detectSensitiveContent } from "@/lib/safety";

import { getWeatherAdapter } from "./adapters/weather";
import { getWebSearchAdapter } from "./adapters/web-search";
import {
  AnalyzeDocumentArgs,
  CompareDocumentsArgs,
  CreatePendingActionForMemoArgs,
  GetDocumentDetailArgs,
  GetRecentMemosArgs,
  GetWeatherArgs,
  ListDocumentsArgs,
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
 *  - DB write 는 memos 같은 도메인 테이블에 직접 하지 않는다. 쓰기 계열은 다음 2 단계만 허용된다:
 *      1) `propose_save_memo`              : preview-only. DB 쓰기 없음.
 *      2) `create_pending_action_for_memo` : pending_actions 에 INSERT. 최종 memos 쓰기는 approval confirm 에서.
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
      return runSearchMemos(rawArgs, ctx);
    case "get_recent_memos":
      return runGetRecentMemos(rawArgs, ctx);
    case "get_weather":
      return runGetWeather(rawArgs);
    case "search_web":
      return runSearchWeb(rawArgs);
    case "list_documents":
      return runListDocuments(rawArgs, ctx);
    case "get_document_detail":
      return runGetDocumentDetail(rawArgs, ctx);
    case "compare_documents":
      return runCompareDocuments(rawArgs, ctx);
    case "analyze_document":
      return runAnalyzeDocument(rawArgs, ctx);
    case "propose_save_memo":
      return runProposeSaveMemo(rawArgs, ctx);
    case "create_pending_action_for_memo":
      return runCreatePendingActionForMemo(rawArgs, ctx);
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

async function runSearchMemos(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
  const parsed = SearchMemosArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "search_memos", reason: "invalid_arguments" };
  }
  const result = await searchMemos({
    query: parsed.data.query,
    limit: parsed.data.limit,
    audit: {
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      source: "assistant",
    },
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

async function runGetRecentMemos(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
  const parsed = GetRecentMemosArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "get_recent_memos", reason: "invalid_arguments" };
  }
  const result = await listMemos({
    limit: parsed.data.limit ?? 10,
    offset: parsed.data.offset,
    project_key: parsed.data.project_key ?? null,
    sort: parsed.data.sort,
    audit: {
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      source: "assistant",
    },
  });
  return {
    kind: "data",
    name: "get_recent_memos",
    payload: {
      count: result.items.length,
      page: result.page,
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

async function runListDocuments(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
  const parsed = ListDocumentsArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "list_documents", reason: "invalid_arguments" };
  }
  const supabase = await createClient();
  const result = await listDocuments(supabase, {
    scope_user_id: ctx.user_id,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor ?? null,
    sort: parsed.data.sort,
    audit: {
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      source: "assistant",
    },
  });
  return {
    kind: "data",
    name: "list_documents",
    payload: {
      count: result.items.length,
      next_cursor: result.next_cursor,
      sort: result.sort,
      items: result.items.map(projectDocumentListItemForModel),
    },
  };
}

async function runGetDocumentDetail(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
  const parsed = GetDocumentDetailArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "get_document_detail", reason: "invalid_arguments" };
  }
  const supabase = await createClient();
  const result = await getDocumentDetail(supabase, parsed.data.document_id, {
    user_id: ctx.user_id,
    user_email: ctx.user_email ?? null,
    source: "assistant",
  });
  if (!result.ok) {
    return {
      kind: "error",
      name: "get_document_detail",
      reason: result.reason === "forbidden" ? "forbidden" : "not_found",
    };
  }
  return {
    kind: "data",
    name: "get_document_detail",
    payload: { document: projectDocumentDetailForModel(result.document) },
  };
}

async function runCompareDocuments(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
  const parsed = CompareDocumentsArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "compare_documents", reason: "invalid_arguments" };
  }
  const result = await compareDocuments(parsed.data.document_ids, {
    user_id: ctx.user_id,
    user_email: ctx.user_email ?? null,
  });
  if (result.status === "error") {
    return {
      kind: "error",
      name: "compare_documents",
      reason: result.reason,
    };
  }
  return {
    kind: "data",
    name: "compare_documents",
    payload: {
      ...result.result,
      persisted: result.persisted,
      summary_id: result.summary?.id ?? null,
      comparison_history_id: result.comparison_history_id,
    },
  };
}

async function runAnalyzeDocument(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
  const parsed = AnalyzeDocumentArgs.safeParse(raw);
  if (!parsed.success) {
    return { kind: "error", name: "analyze_document", reason: "invalid_arguments" };
  }
  const result = await analyzeDocument(parsed.data.document_id, {
    user_id: ctx.user_id,
    user_email: ctx.user_email ?? null,
  });
  if (result.status === "error") {
    return {
      kind: "error",
      name: "analyze_document",
      reason: result.reason,
    };
  }
  return {
    kind: "data",
    name: "analyze_document",
    payload: {
      ...result.result,
      persisted: result.persisted,
      summary_id: result.summary?.id ?? null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// proposal tools (2-stage write-safe flow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 1 — propose_save_memo (preview only).
 *
 * DB 에 어떤 것도 쓰지 않는다. 저장 예정 내용의 구조화된 미리보기만 반환한다.
 * 모델은 이 결과를 바탕으로 사용자에게 확인 질문을 던지거나,
 * 사용자의 원문이 이미 명시적 저장 요청이면 바로 create_pending_action_for_memo 로 넘어간다.
 */
async function runProposeSaveMemo(raw: unknown, ctx: AssistantRunContext): Promise<ToolResult> {
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
  const sensitivityFlag = sensitivityMatches.length > 0;
  const sensitivityCategories = sensitivityMatches.map((m) => m.category);

  await logAssistantProposalGenerated({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    session_id: ctx.session_id ?? null,
    tool_name: "propose_save_memo",
    content_length: content.length,
    sensitivity_flag: sensitivityFlag,
    sensitivity_categories: sensitivityCategories,
  });

  return {
    kind: "data",
    name: "propose_save_memo",
    payload: {
      kind: "proposal_preview",
      would_save: false,
      title: parsed.data.title ?? null,
      project_key: parsed.data.project_key ?? null,
      tags: parsed.data.tags ?? [],
      content_preview: content.trim().slice(0, ASSISTANT_MEMO_MODEL_PREVIEW_MAX_CHARS),
      content_length: content.length,
      sensitivity_flag: sensitivityFlag,
      sensitivity_categories: sensitivityCategories,
      note: "This is a proposal preview only. No pending_action has been created. To actually queue the save, call create_pending_action_for_memo after the user has confirmed.",
    },
  };
}

/**
 * Stage 2 — create_pending_action_for_memo.
 *
 * 실제로 `pending_actions` 테이블에 `action_type=save_memo, status=awaiting_approval`
 * 레코드를 INSERT 한다. 하지만 그 전에:
 *
 *   1) 현재 턴의 사용자 메시지가 명시적 저장 의도인지 서버 측에서 재검증(intent gate).
 *      모델이 단독으로 "저장 의도가 있어 보인다" 라고 판단하는 것만으로는 통과할 수 없다.
 *   2) `createMemoDraft` 에 들어가면 거기서 다시 `evaluateMemoCreate` 정책이 적용되고
 *      `detectSensitiveContent` 가 sensitivity_flag 를 결정한다.
 *
 * memos 테이블에는 이 단계에서 아무것도 쓰지 않는다. 최종 저장은 여전히 /api/approvals/[id]/confirm 이다.
 */
async function runCreatePendingActionForMemo(
  raw: unknown,
  ctx: AssistantRunContext,
): Promise<ToolResult> {
  const parsed = CreatePendingActionForMemoArgs.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: "error",
      name: "create_pending_action_for_memo",
      reason: "invalid_arguments",
    };
  }

  // 1) Server-side intent gate.
  const intent = evaluateSaveMemoIntent(ctx.user_message ?? "");
  if (!intent.allowed) {
    await logAssistantSaveIntentBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      session_id: ctx.session_id ?? null,
      reason: intent.reason,
    });
    return {
      kind: "blocked",
      name: "create_pending_action_for_memo",
      reason: intent.reason,
    };
  }

  // 2) Delegate to memos domain (runs policy + sensitivity + pending_actions INSERT + audit logs).
  const result = await createMemoDraft(
    {
      content: parsed.data.content,
      title: parsed.data.title ?? null,
      project_key: parsed.data.project_key ?? null,
      tags: normalizeMemoTagList(parsed.data.tags ?? null),
      source_type: "chat",
      explicit: true,
    },
    { user_id: ctx.user_id, user_email: ctx.user_email ?? null },
  );

  if (result.status === "blocked") {
    return {
      kind: "blocked",
      name: "create_pending_action_for_memo",
      reason: result.reason,
    };
  }

  await logAssistantPendingActionCreated({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    session_id: ctx.session_id ?? null,
    pending_action_id: result.pending_action_id,
    sensitivity_flag: result.sensitivity_flag,
  });

  return {
    kind: "pending_action",
    name: "create_pending_action_for_memo",
    pending_action_id: result.pending_action_id,
    sensitivity_flag: result.sensitivity_flag,
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
  tags: string[];
  pinned: boolean;
  bookmarked: boolean;
  sensitivity_flag: boolean;
  created_at: string;
  updated_at: string;
};

function projectDocumentListItemForModel(item: DocumentListItemPayload) {
  return {
    id: item.id,
    title: item.title,
    file_name: item.file_name,
    file_type: item.file_type,
    status: item.status,
    parsing_status: item.parsing_status,
    preprocessing_status: item.preprocessing_status,
    summary_status: item.summary_status,
    parsing_error_code: item.parsing_error_code,
    latest_summary_exists: item.latest_summary_exists,
    latest_summary_preview: item.latest_summary_preview,
    latest_comparison_exists: item.latest_comparison_exists,
    latest_comparison_preview: item.latest_comparison_preview,
    latest_comparison_anchor_role: item.latest_comparison_anchor_role,
    latest_analysis_exists: item.latest_analysis_exists,
    latest_analysis_preview: item.latest_analysis_preview,
    can_summarize: item.can_summarize,
    can_compare: item.can_compare,
    updated_at: item.updated_at,
  };
}

const ASSISTANT_DOCUMENT_SUMMARY_MAX = 800;

function truncateLatestForAssistant<T extends { content: string }>(
  block: T | null,
): (T & { content_truncated: boolean }) | null {
  if (!block) return null;
  const content = block.content;
  const truncated = content.length > ASSISTANT_DOCUMENT_SUMMARY_MAX;
  return {
    ...block,
    content: truncated ? `${content.slice(0, ASSISTANT_DOCUMENT_SUMMARY_MAX - 1)}…` : content,
    content_truncated: truncated,
  };
}

function projectDocumentDetailForModel(d: DocumentDetailPayload) {
  return {
    ...d,
    latest_summary: truncateLatestForAssistant(d.latest_summary),
    latest_comparison: truncateLatestForAssistant(d.latest_comparison),
    latest_analysis: truncateLatestForAssistant(d.latest_analysis),
  };
}

function projectMemoForModel(memo: {
  id: string;
  title: string | null;
  content_preview: string;
  summary: string | null;
  project_key: string | null;
  tags: string[];
  pinned: boolean;
  bookmarked: boolean;
  sensitivity_flag: boolean;
  created_at: string;
  updated_at: string;
}): MemoProjection {
  // 모델 컨텍스트를 아끼기 위해 원문 대신 summary(있으면) 또는 미리보기만 넘긴다.
  const cap = ASSISTANT_MEMO_MODEL_PREVIEW_MAX_CHARS;
  const base = (memo.summary ?? memo.content_preview).trim();
  const preview = base.length > cap ? `${base.slice(0, cap - 1)}…` : base;
  return {
    id: memo.id,
    title: memo.title,
    preview,
    project_key: memo.project_key,
    tags: memo.tags,
    pinned: memo.pinned,
    bookmarked: memo.bookmarked,
    sensitivity_flag: memo.sensitivity_flag,
    created_at: memo.created_at,
    updated_at: memo.updated_at,
  };
}
