import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  logDocumentReadDetail,
  logDocumentReadForbidden,
  logDocumentReadMissing,
  logDocumentReadSummaryFailed,
  type DocumentReadSource,
} from "@/lib/logging/audit-log";
import {
  evaluateDocumentCanCompareEligible,
  evaluateDocumentCanSummarize,
} from "@/lib/policies/document-detail";
import type { Document, DocumentDetailPayload } from "@/types/document";

import {
  loadLatestSummaryReadTripletForUser,
  mapSummaryReadItemToLatestPublic,
} from "./document-latest-summaries-load";
import { DOCUMENT_ROW_SELECT } from "./document-columns";

export type GetDocumentDetailContext = {
  user_id: string;
  user_email?: string | null;
  source: DocumentReadSource;
};

export type GetDocumentDetailResult =
  | { ok: true; document: DocumentDetailPayload }
  | { ok: false; reason: "not_found" | "forbidden" };

/**
 * RLS 사용자 클라이언트로 문서 상세(메타 + 공개 요약 필드 + chunk 수·플래그)를 구성한다.
 * `parsed_text`·청크 본문은 응답에 포함하지 않는다.
 */
export async function getDocumentDetail(
  supabase: SupabaseClient,
  documentId: string,
  ctx: GetDocumentDetailContext,
): Promise<GetDocumentDetailResult> {
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select(DOCUMENT_ROW_SELECT)
    .eq("id", documentId)
    .maybeSingle();

  if (docErr || !doc) {
    await logDocumentReadMissing({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
    });
    return { ok: false, reason: "not_found" };
  }

  const row = doc as Document;

  if (row.user_id !== ctx.user_id) {
    await logDocumentReadForbidden({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
    });
    return { ok: false, reason: "forbidden" };
  }

  const { count: chunkCountRaw, error: countErr } = await supabase
    .from("document_chunks")
    .select("*", { count: "exact", head: true })
    .eq("document_id", documentId);

  const chunk_count = countErr ? 0 : chunkCountRaw ?? 0;

  const triplet = await loadLatestSummaryReadTripletForUser(
    supabase,
    documentId,
    ctx.user_id,
  );
  if (triplet.fetchErrors.length > 0) {
    await logDocumentReadSummaryFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
      error_message: triplet.fetchErrors.slice(0, 3).join("; ").slice(0, 200),
    });
  }

  const latest_summary = mapSummaryReadItemToLatestPublic(triplet.summary);
  const latest_comparison = triplet.comparison_public;
  const latest_analysis = mapSummaryReadItemToLatestPublic(triplet.analysis);

  const hasParsedText = Boolean((row.parsed_text ?? "").trim());
  const payload: DocumentDetailPayload = {
    id: row.id,
    title: row.title,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    source: row.storage_path ? "upload" : "pending",
    status: row.status,
    parsing_status: row.parsing_status,
    preprocessing_status: row.preprocessing_status,
    summary_status: row.summary_status,
    parsing_error_code: row.parsing_error_code,
    sha256_hash: row.sha256_hash,
    created_at: row.created_at,
    updated_at: row.updated_at,
    latest_summary,
    latest_comparison,
    latest_analysis,
    chunk_count,
    can_summarize: evaluateDocumentCanSummarize({
      status: row.status,
      parsing_status: row.parsing_status,
      preprocessing_status: row.preprocessing_status,
      summary_status: row.summary_status,
      chunkCount: chunk_count,
      hasParsedText,
    }),
    can_compare: evaluateDocumentCanCompareEligible({
      status: row.status,
      parsing_status: row.parsing_status,
      preprocessing_status: row.preprocessing_status,
      summary_status: row.summary_status,
      chunkCount: chunk_count,
      hasParsedText,
    }),
  };

  await logDocumentReadDetail({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
    source: ctx.source,
    chunk_count,
    has_summary: Boolean(latest_summary),
    summary_id_prefix: latest_summary?.id?.slice(0, 8) ?? null,
    has_comparison: Boolean(latest_comparison),
    has_analysis: Boolean(latest_analysis),
  });

  return { ok: true, document: payload };
}
