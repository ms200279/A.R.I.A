import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logDocumentSummarizePolicyBlocked,
  logDocumentSummarizeSkipped,
  logDocumentSummarizeStarted,
  logDocumentSummarized,
  logDocumentSummaryPersistFailed,
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
import {
  prepareDocumentChunkTextForSummarize,
  prepareDocumentTextForSummarize,
} from "@/lib/safety/document-text";
import type { Document, DocumentSummary } from "@/types/document";

import { DOCUMENT_ROW_SELECT, DOCUMENT_SUMMARY_ROW_SELECT } from "./document-columns";

/**
 * 문서 요약 저장 정책
 * -----------------
 * - `summary_type='summary'` 는 문서당 **논리적으로 1건**(DB 유니크 `(document_id, summary_type)`).
 * - `mode=regenerate`(기본): 요약기를 실행하고 **UPSERT** 로 기존 행을 덮어쓴다(`updated_at` 갱신).
 * - `mode=if_empty`: 이미 요약 본문이 있으면 **실행·저장 생략**, 기존 행 반환.
 * - 입력 텍스트는 `document_chunks`(우선) 또는 `documents.parsed_text` 에서 구성하고,
 *   provider 호출 전 `prepareDocument*ForSummarize` 로 비신뢰 원문을 최소 정규화한다.
 * - 도메인 서비스는 `runSummarizerWithFallback` 만 호출하며 Gemini/rule 구현 세부는 알지 않는다.
 */

export type SummarizeDocumentMode = "regenerate" | "if_empty";

export type SummarizeDocumentContext = {
  user_id: string;
  user_email?: string | null;
};

export type SummarizeDocumentResult =
  | { status: "ok"; summary: DocumentSummary }
  | { status: "error"; reason: string };

type ChunkRow = { chunk_index: number; content: string };

function buildSanitizedDocumentInput(args: {
  chunks: ChunkRow[] | null;
  parsedText: string | null;
}): {
  text: string;
  source: "document_chunks" | "parsed_text";
  chunkRowCount: number | null;
} {
  if (args.chunks && args.chunks.length > 0) {
    const parts = args.chunks
      .slice()
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map((c) => prepareDocumentChunkTextForSummarize(c.content))
      .filter((p) => p.length > 0);
    return {
      text: parts.join("\n\n"),
      source: "document_chunks",
      chunkRowCount: args.chunks.length,
    };
  }
  return {
    text: prepareDocumentTextForSummarize(args.parsedText ?? ""),
    source: "parsed_text",
    chunkRowCount: null,
  };
}

export async function summarizeDocument(
  documentId: string,
  ctx: SummarizeDocumentContext,
  options: { mode?: SummarizeDocumentMode } = {},
): Promise<SummarizeDocumentResult> {
  const mode: SummarizeDocumentMode = options.mode ?? "regenerate";
  const regenerate = mode === "regenerate";

  const supabase = await createClient();
  const { data: doc, error: loadErr } = await supabase
    .from("documents")
    .select(DOCUMENT_ROW_SELECT)
    .eq("id", documentId)
    .maybeSingle();

  if (loadErr || !doc) {
    return { status: "error", reason: "document_not_found" };
  }

  const row = doc as Document;

  if (mode === "if_empty") {
    const { data: existing } = await supabase
      .from("document_summaries")
      .select(DOCUMENT_SUMMARY_ROW_SELECT)
      .eq("document_id", documentId)
      .eq("summary_type", "summary")
      .maybeSingle();
    if (existing && (existing as DocumentSummary).content.trim().length > 0) {
      await logDocumentSummarizeSkipped({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        document_id: documentId,
        reason: "if_empty_already_set",
      });
      return { status: "ok", summary: existing as DocumentSummary };
    }
  }

  const { data: chunkRows, error: chunkErr } = await supabase
    .from("document_chunks")
    .select("chunk_index,content")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (chunkErr) {
    return { status: "error", reason: "document_chunks_load_failed" };
  }

  const { text: sanitizedInput, source: inputSource, chunkRowCount } =
    buildSanitizedDocumentInput({
      chunks: (chunkRows as ChunkRow[] | null) ?? null,
      parsedText: row.parsed_text,
    });

  if (!sanitizedInput.trim()) {
    await logDocumentSummarizePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      policy_reason: "empty_document",
    });
    return { status: "error", reason: "document_empty" };
  }

  const contentPolicy = evaluateSummarizerContentPolicy({
    resourceKind: "document",
    content: sanitizedInput,
  });
  if (!contentPolicy.ok) {
    await logDocumentSummarizePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      policy_reason: contentPolicy.reason,
    });
    return { status: "error", reason: "content_policy_violation" };
  }

  await logDocumentSummarizeStarted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
    regenerate,
    input_source: inputSource,
    chunk_row_count: chunkRowCount,
    sanitized_content_length: sanitizedInput.length,
  });

  const env = resolveSummarizerEnv();
  const intendedLabel = intendedProviderLabel(env);

  const { data: existingForPrompt } = await supabase
    .from("document_summaries")
    .select("content")
    .eq("document_id", documentId)
    .eq("summary_type", "summary")
    .maybeSingle();

  const existingSummary =
    existingForPrompt && typeof (existingForPrompt as { content?: string }).content === "string"
      ? (existingForPrompt as { content: string }).content
      : null;

  await logSummarizerRequestReceived({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    resource_id: documentId,
    resource_kind: "document",
    content_length: sanitizedInput.length,
    title_present: Boolean((row.title ?? "").trim()),
    intended_provider: intendedLabel,
    regenerate,
  });

  const { output, geminiError, attemptedPrimary, safetySkippedProvider } =
    await runSummarizerWithFallback({
      userId: ctx.user_id,
      resourceKind: "document",
      resourceId: documentId,
      title: row.title,
      content: sanitizedInput,
      existingSummary,
      regenerate,
      mode: mode === "if_empty" ? "if_empty" : "regenerate",
      metadata: {
        document_input_source: inputSource,
        document_chunk_row_count: chunkRowCount,
      },
    });

  if (geminiError) {
    await logSummarizerGeminiFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      resource_id: documentId,
      error_code: "gemini_error",
      error_message: geminiError.slice(0, 200),
    });
    await logSummarizerFallbackUsed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      resource_id: documentId,
      from_provider: "gemini",
      to_provider: "rule",
      reason: "exception",
    });
  }

  const summaryText = (output.summary ?? "").trim();
  if (!summaryText) {
    return { status: "error", reason: "summary_empty" };
  }

  const sourceRanges: Record<string, unknown> = {
    input_source: inputSource,
    chunk_row_count: chunkRowCount,
    sanitized_input_length: sanitizedInput.length,
    chunked: output.chunked,
    chunk_count: output.chunkCount ?? null,
    strategy: output.strategy,
    provider: output.provider,
  };

  const service = createServiceClient();
  const { data: upserted, error: upsertErr } = await service
    .from("document_summaries")
    .upsert(
      {
        document_id: documentId,
        user_id: ctx.user_id,
        summary_type: "summary",
        content: summaryText,
        source_ranges: sourceRanges,
      },
      { onConflict: "document_id,summary_type" },
    )
    .select(DOCUMENT_SUMMARY_ROW_SELECT)
    .single();

  if (upsertErr || !upserted) {
    await logDocumentSummaryPersistFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      error_message: upsertErr?.message ?? "unknown",
    });
    return { status: "error", reason: "summary_persist_failed" };
  }

  await logSummarizerProviderResolved({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    resource_id: documentId,
    resource_kind: "document",
    provider: output.provider,
    model: output.model,
    strategy: output.strategy,
    chunked: output.chunked,
    chunk_count: output.chunkCount ?? null,
    safety_skipped_provider: safetySkippedProvider,
    extra_metadata: {
      attempted_primary: attemptedPrimary,
      document_input_source: inputSource,
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
    input_source: inputSource,
  };
  if (output.usage) {
    meta.input_tokens = output.usage.input_tokens;
    meta.output_tokens = output.usage.output_tokens;
    meta.total_tokens = output.usage.total_tokens;
  }
  if (output.metadata) {
    meta.summarizer = output.metadata;
  }

  await logDocumentSummarized({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
    strategy: output.strategy,
    metadata: meta,
  });

  return { status: "ok", summary: upserted as DocumentSummary };
}
