import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type {
  ComparisonAnchorRole,
  ComparisonHistoryDetailPayload,
} from "@/types/document";

import { normalizeEmbeddedDocumentMeta } from "./supabase-embed-doc";

export type GetComparisonHistoryContext = {
  user_id: string;
};

export type GetComparisonHistoryResult =
  | { ok: true; data: ComparisonHistoryDetailPayload }
  | { ok: false; reason: "not_found" };

/**
 * 단일 비교 히스토리 상세(참여 문서 메타 포함). RLS + user_id 로 스코프.
 */
export async function getComparisonHistoryDetail(
  supabase: SupabaseClient,
  comparisonId: string,
  ctx: GetComparisonHistoryContext,
): Promise<GetComparisonHistoryResult> {
  const { data, error } = await supabase
    .from("comparison_histories")
    .select(
      `
      id,
      summary_id,
      primary_document_id,
      content,
      source_ranges,
      created_at,
      updated_at,
      comparison_history_documents (
        document_id,
        anchor_role,
        sort_order,
        documents ( title, file_name )
      )
    `,
    )
    .eq("id", comparisonId)
    .eq("user_id", ctx.user_id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }

  const row = data as unknown as {
    id: string;
    summary_id: string | null;
    primary_document_id: string;
    content: string;
    source_ranges: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    comparison_history_documents: Array<{
      document_id: string;
      anchor_role: string;
      sort_order: number;
      documents: unknown;
    }> | null;
  };

  const anchors = [...(row.comparison_history_documents ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const documents = anchors.map((a) => {
    const doc = normalizeEmbeddedDocumentMeta(a.documents);
    return {
      id: a.document_id,
      title: doc?.title ?? null,
      file_name: doc?.file_name ?? null,
      anchor_role: (a.anchor_role === "primary" ? "primary" : "peer") as ComparisonAnchorRole,
      sort_order: a.sort_order,
    };
  });

  const payload: ComparisonHistoryDetailPayload = {
    comparison_id: row.id,
    summary_id: row.summary_id,
    primary_document_id: row.primary_document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    content: sanitizeStoredSummaryForRead(row.content),
    source_ranges: row.source_ranges,
    documents,
  };

  return { ok: true, data: payload };
}
