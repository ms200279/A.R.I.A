import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logMemoSummarizeSkipped,
  logMemoSummarized,
} from "@/lib/logging/audit-log";
import type { Memo } from "@/types/memo";

import { MEMO_ROW_SELECT } from "./memo-columns";

/**
 * 메모 요약 어댑터.
 *
 * 현재 단계에서는 LLM 공급자를 고정하지 않는다. 규칙 기반(첫 문장 + 길이 제한)
 * 요약만 기본 구현으로 제공한다. 추후 LLM 공급자가 결정되면 이 인터페이스를
 * 구현하는 모듈로 교체한다.
 */
export interface SummarizerAdapter {
  readonly strategy: string;
  summarize(input: { title: string | null; content: string }): Promise<string>;
}

export const ruleBasedSummarizer: SummarizerAdapter = {
  strategy: "rule_based_v1",
  async summarize({ title, content }) {
    return buildRuleBasedSummary(title, content);
  },
};

const SUMMARY_MAX_CHARS = 280;

function buildRuleBasedSummary(title: string | null, content: string): string {
  const cleaned = (content ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return (title ?? "").trim();

  // 문장 종결 부호 기반 초기 분할. 한국어 문장부호도 포함.
  const sentences = cleaned
    .split(/(?<=[.!?。！？])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  let draft = "";
  for (const s of sentences) {
    const candidate = draft ? `${draft} ${s}` : s;
    if (candidate.length > SUMMARY_MAX_CHARS) {
      if (!draft) {
        // 한 문장만으로도 너무 길면 잘라서 사용.
        return cleaned.slice(0, SUMMARY_MAX_CHARS - 1) + "…";
      }
      break;
    }
    draft = candidate;
    if (draft.length >= SUMMARY_MAX_CHARS * 0.7 && sentences.indexOf(s) >= 1) {
      break;
    }
  }
  if (!draft) {
    return cleaned.slice(0, SUMMARY_MAX_CHARS - 1) + "…";
  }
  return draft;
}

/**
 * - `regenerate` (기본): 항상 새 요약을 생성해 `memos.summary` 를 덮어쓴다.
 * - `if_empty`: `summary` 가 비어 있을 때만 생성. 이미 있으면 **스킵**하고 기존 행을 반환.
 *   (스킵 시 `memo.summarize.skipped` 감사 로그, `memo.summarized` 는 남기지 않음)
 */
export type SummarizeMode = "regenerate" | "if_empty";

export type SummarizeMemoContext = {
  user_id: string;
  user_email?: string | null;
};

export type SummarizeMemoResult =
  | { status: "ok"; memo: Memo }
  | { status: "error"; reason: string };

/**
 * 메모를 요약하고 memos.summary 를 갱신한다(모드에 따라).
 * 조회는 RLS 가 걸린 user client, 업데이트는 `user_id` 조건 + service_role.
 */
export async function summarizeMemo(
  memoId: string,
  ctx: SummarizeMemoContext,
  options: {
    mode?: SummarizeMode;
    adapter?: SummarizerAdapter;
  } = {},
): Promise<SummarizeMemoResult> {
  const mode: SummarizeMode = options.mode ?? "regenerate";
  const adapter: SummarizerAdapter = options.adapter ?? ruleBasedSummarizer;

  const supabase = await createClient();

  const { data: memo, error: loadErr } = await supabase
    .from("memos")
    .select(MEMO_ROW_SELECT)
    .eq("id", memoId)
    .maybeSingle();

  if (loadErr || !memo) {
    return { status: "error", reason: "memo_not_found" };
  }
  if ((memo as Memo).user_id !== ctx.user_id) {
    return { status: "error", reason: "forbidden" };
  }

  const current = memo as Memo;

  if (mode === "if_empty" && (current.summary ?? "").trim().length > 0) {
    await logMemoSummarizeSkipped({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      memo_id: memoId,
      reason: "if_empty_already_set",
      strategy: adapter.strategy,
    });
    return { status: "ok", memo: current };
  }

  const summary = await adapter.summarize({
    title: current.title,
    content: current.content,
  });

  const service = createServiceClient();
  const { data: updated, error: updErr } = await service
    .from("memos")
    .update({ summary })
    .eq("id", memoId)
    .eq("user_id", ctx.user_id)
    .select(MEMO_ROW_SELECT)
    .single();

  if (updErr || !updated) {
    return { status: "error", reason: "summary_update_failed" };
  }

  await logMemoSummarized({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    memo_id: memoId,
    strategy: adapter.strategy,
  });

  return { status: "ok", memo: updated as Memo };
}
