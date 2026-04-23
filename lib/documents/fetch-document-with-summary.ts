import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Document, DocumentSummary } from "@/types/document";

import { DOCUMENT_ROW_SELECT, DOCUMENT_SUMMARY_ROW_SELECT } from "./document-columns";

/**
 * RLS 가 적용된 클라이언트로 단건 문서 + 최신 `summary` 행을 조회한다.
 * (향후 `GET /api/documents/[id]`·비교 API 에서 재사용)
 */
export async function fetchDocumentWithLatestSummary(
  supabase: SupabaseClient,
  documentId: string,
): Promise<{ document: Document; summary: DocumentSummary | null } | null> {
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select(DOCUMENT_ROW_SELECT)
    .eq("id", documentId)
    .maybeSingle();

  if (docErr || !doc) {
    return null;
  }

  const { data: summaryRow } = await supabase
    .from("document_summaries")
    .select(DOCUMENT_SUMMARY_ROW_SELECT)
    .eq("document_id", documentId)
    .eq("summary_type", "summary")
    .maybeSingle();

  return {
    document: doc as Document,
    summary: summaryRow ? (summaryRow as DocumentSummary) : null,
  };
}
