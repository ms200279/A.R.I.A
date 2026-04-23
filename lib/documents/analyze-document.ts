import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logDocumentAnalyzeCompleted,
  logDocumentAnalyzeFailed,
  logDocumentAnalyzePolicyBlocked,
  logDocumentAnalyzeStarted,
} from "@/lib/logging/audit-log";
import { DOCUMENT_ANALYZE_INPUT_MAX_CHARS } from "@/lib/policies/document-llm";
import { evaluateSummarizerContentPolicy } from "@/lib/policies/summarize-content";
import { runAnalyzeDocumentLlm } from "@/lib/summarizers/document-llm-tasks";
import type { Document, DocumentAnalyzeResultPayload, DocumentSummary } from "@/types/document";

import { DOCUMENT_ROW_SELECT, DOCUMENT_SUMMARY_ROW_SELECT } from "./document-columns";
import { loadSanitizedDocumentTextForModel } from "./document-model-input";

const MAX_SUMMARY_DB_CHARS = 32_000;

export type AnalyzeDocumentContext = {
  user_id: string;
  user_email?: string | null;
};

export type AnalyzeDocumentResult =
  | { status: "ok"; result: DocumentAnalyzeResultPayload; persisted: boolean; summary: DocumentSummary | null }
  | { status: "error"; reason: string };

function serializeAnalyzeForDb(payload: DocumentAnalyzeResultPayload): string {
  const s = JSON.stringify(payload);
  if (s.length <= MAX_SUMMARY_DB_CHARS) return s;
  const clipped: DocumentAnalyzeResultPayload = {
    ...payload,
    analysis: payload.analysis.slice(0, 6000),
    key_points: (payload.key_points ?? []).slice(0, 20),
    potential_risks: (payload.potential_risks ?? []).slice(0, 20),
    follow_up_questions: (payload.follow_up_questions ?? []).slice(0, 20),
    source_ranges: { ...(payload.source_ranges ?? {}), content_truncated: true },
  };
  let out = JSON.stringify(clipped);
  if (out.length > MAX_SUMMARY_DB_CHARS) {
    out = out.slice(0, MAX_SUMMARY_DB_CHARS - 40) + `,"_truncated":true}`;
  }
  return out;
}

/**
 * 단일 문서 분석(요약과 구분되는 해석·리스크·후속 질문).
 *
 * 저장 정책: `summary_type='analysis'` 를 문서당 1행 UPSERT (`document_id`, `analysis`).
 */
export async function analyzeDocument(
  documentId: string,
  ctx: AnalyzeDocumentContext,
): Promise<AnalyzeDocumentResult> {
  await logDocumentAnalyzeStarted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
  });

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
  if (row.user_id !== ctx.user_id) {
    return { status: "error", reason: "forbidden" };
  }

  const loaded = await loadSanitizedDocumentTextForModel(supabase, documentId);
  if (!loaded.ok) {
    await logDocumentAnalyzePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      reason: loaded.reason,
    });
    return { status: "error", reason: loaded.reason };
  }

  let text = loaded.text;
  let inputTruncated = false;
  if (text.length > DOCUMENT_ANALYZE_INPUT_MAX_CHARS) {
    text = `${text.slice(0, DOCUMENT_ANALYZE_INPUT_MAX_CHARS)}\n…[truncated]`;
    inputTruncated = true;
  }

  const policy = evaluateSummarizerContentPolicy({
    resourceKind: "document",
    content: text,
  });
  if (!policy.ok) {
    await logDocumentAnalyzePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      reason: policy.reason,
    });
    return { status: "error", reason: "content_policy_violation" };
  }

  const llm = await runAnalyzeDocumentLlm({
    userId: ctx.user_id,
    documentId,
    title: row.title,
    text,
  });

  const result: DocumentAnalyzeResultPayload = {
    document_id: documentId,
    analysis: llm.analysis,
    key_points: llm.key_points,
    potential_risks: llm.potential_risks,
    follow_up_questions: llm.follow_up_questions,
    source_ranges: {
      input_truncated: inputTruncated,
      chunked_condensation: llm.chunked,
      provider: llm.provider,
    },
  };

  const service = createServiceClient();
  const contentStr = serializeAnalyzeForDb(result);
  const { data: upserted, error: upErr } = await service
    .from("document_summaries")
    .upsert(
      {
        document_id: documentId,
        user_id: ctx.user_id,
        summary_type: "analysis",
        content: contentStr,
        source_ranges: {
          provider: llm.provider,
          chunked: llm.chunked,
          input_truncated: inputTruncated,
        },
      },
      { onConflict: "document_id,summary_type" },
    )
    .select(DOCUMENT_SUMMARY_ROW_SELECT)
    .single();

  const persisted = Boolean(upserted && !upErr);
  if (!persisted) {
    await logDocumentAnalyzeFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      reason: "analysis_persist_failed",
    });
  }

  await logDocumentAnalyzeCompleted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
    provider: llm.provider,
    chunked: llm.chunked || inputTruncated,
  });

  return {
    status: "ok",
    result,
    persisted,
    summary: persisted ? (upserted as DocumentSummary) : null,
  };
}
