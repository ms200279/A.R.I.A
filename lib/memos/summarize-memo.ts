import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logMemoSummarizePolicyBlocked,
  logMemoSummarized,
  logMemoSummaryPersistFailed,
  logMemoSummarizeSkipped,
  logSummarizerFallbackUsed,
  logSummarizerGeminiFailed,
  logSummarizerProviderResolved,
  logSummarizerRequestReceived,
} from "@/lib/logging/audit-log";
import { evaluateSummarizerContentPolicy } from "@/lib/policies/summarize-content";
import {
  intendedProviderLabel,
  resolveSummarizerEnv,
  runSummarizerWithFallback,
} from "@/lib/summarizers";
import type { Memo } from "@/types/memo";

import { MEMO_ROW_SELECT } from "./memo-columns";
import { normalizeMemoRow } from "./map-memo-dto";

/**
 * 메모 요약 정책 (API / UI 공통)
 * -----------------
 * - `mode=regenerate` (기본): 항상 요약기를 호출해 **summary 를 덮어쓴다**. (UI 「다시 요약」과 동일)
 * - `mode=if_empty`: DB 의 `summary` 가 비어 있을 때만 생성. 이미 값이 있으면 **DB 쓰기 없음**.
 * - 문장 생성은 `lib/summarizers` 의 `runSummarizerWithFallback`(게이트 + rule/Gemini)이 담당한다.
 */

export type SummarizeMode = "regenerate" | "if_empty";

export type SummarizeMemoContext = {
  user_id: string;
  user_email?: string | null;
};

export type SummarizeMemoResult =
  | { status: "ok"; memo: Memo }
  | { status: "error"; reason: string };

export async function summarizeMemo(
  memoId: string,
  ctx: SummarizeMemoContext,
  options: {
    mode?: SummarizeMode;
  } = {},
): Promise<SummarizeMemoResult> {
  const mode: SummarizeMode = options.mode ?? "regenerate";

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
      strategy: "skipped_not_run",
    });
    return { status: "ok", memo: normalizeMemoRow(current) };
  }

  const contentPolicy = evaluateSummarizerContentPolicy({
    resourceKind: "memo",
    content: current.content ?? "",
  });
  if (!contentPolicy.ok) {
    await logMemoSummarizePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      memo_id: memoId,
      policy_reason: contentPolicy.reason,
    });
    return { status: "error", reason: "content_policy_violation" };
  }

  const env = resolveSummarizerEnv();
  const intendedLabel = intendedProviderLabel(env);
  const regenerate = mode === "regenerate";

  await logSummarizerRequestReceived({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    resource_id: memoId,
    resource_kind: "memo",
    content_length: (current.content ?? "").length,
    title_present: Boolean((current.title ?? "").trim()),
    intended_provider: intendedLabel,
    regenerate,
  });

  const { output, geminiError, attemptedPrimary, safetySkippedProvider } =
    await runSummarizerWithFallback({
      userId: ctx.user_id,
      resourceKind: "memo",
      resourceId: memoId,
      title: current.title,
      content: current.content,
      existingSummary: current.summary,
      regenerate,
      mode,
    });

  if (geminiError) {
    await logSummarizerGeminiFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      resource_id: memoId,
      error_code: "gemini_error",
      error_message: geminiError.slice(0, 200),
    });
    await logSummarizerFallbackUsed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      resource_id: memoId,
      from_provider: "gemini",
      to_provider: "rule",
      reason: "exception",
    });
  }

  const service = createServiceClient();
  const { data: updated, error: updErr } = await service
    .from("memos")
    .update({ summary: output.summary })
    .eq("id", memoId)
    .eq("user_id", ctx.user_id)
    .select(MEMO_ROW_SELECT)
    .single();

  if (updErr || !updated) {
    await logMemoSummaryPersistFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      memo_id: memoId,
      error_message: updErr?.message ?? "unknown",
    });
    return { status: "error", reason: "summary_update_failed" };
  }

  await logSummarizerProviderResolved({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    resource_id: memoId,
    resource_kind: "memo",
    provider: output.provider,
    model: output.model,
    strategy: output.strategy,
    chunked: output.chunked,
    chunk_count: output.chunkCount ?? null,
    safety_skipped_provider: safetySkippedProvider,
    extra_metadata: {
      attempted_primary: attemptedPrimary,
    },
  });

  const meta: Record<string, unknown> = {
    provider: output.provider,
    model: output.model,
    strategy: output.strategy,
    attempted_primary: attemptedPrimary,
    safety_skipped_provider: safetySkippedProvider,
    chunked: output.chunked,
    chunk_count: output.chunkCount ?? null,
  };
  if (output.usage) {
    meta.input_tokens = output.usage.input_tokens;
    meta.output_tokens = output.usage.output_tokens;
    meta.total_tokens = output.usage.total_tokens;
  }
  if (output.metadata) {
    meta.summarizer = output.metadata;
  }

  await logMemoSummarized({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    memo_id: memoId,
    strategy: output.strategy,
    metadata: meta,
  });

  return { status: "ok", memo: normalizeMemoRow(updated) };
}
