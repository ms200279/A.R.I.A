import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type { DocumentSummaryReadItem } from "@/types/document";

export type LatestComparisonFromHistoryRow = {
  content: string;
  created_at: string;
  /** UI·DTO용 공개 id: summary_id 우선, 없으면 히스토리 id */
  public_id: string;
};

/**
 * 문서 id가 참여한 비교 히스토리 중 `created_at` 최신 1건(내용 스냅샷).
 */
export async function fetchLatestComparisonFromHistoryForDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<{ row: LatestComparisonFromHistoryRow | null; errorMessage?: string }> {
  const { map, errorMessage } = await fetchLatestComparisonBatchForDocumentIds(
    supabase,
    userId,
    [documentId],
  );
  return { row: map.get(documentId) ?? null, errorMessage };
}

/**
 * 여러 문서에 대해, 각 문서가 참여한 비교 중 최신 스냅샷(히스토리 기준).
 */
export async function fetchLatestComparisonBatchForDocumentIds(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
): Promise<{
  map: Map<string, LatestComparisonFromHistoryRow>;
  errorMessage?: string;
}> {
  const out = new Map<string, LatestComparisonFromHistoryRow>();
  if (documentIds.length === 0) return { map: out };

  const { data: links, error: linkErr } = await supabase
    .from("comparison_history_documents")
    .select("comparison_history_id, document_id")
    .in("document_id", documentIds)
    .eq("user_id", userId);

  if (linkErr) {
    return { map: out, errorMessage: linkErr.message };
  }
  if (!links?.length) {
    return { map: out };
  }

  const hidSet = new Set(links.map((l) => l.comparison_history_id as string));
  const { data: hists, error: histErr } = await supabase
    .from("comparison_histories")
    .select("id, content, created_at, summary_id")
    .in("id", [...hidSet])
    .eq("user_id", userId);

  if (histErr) {
    return { map: out, errorMessage: histErr.message };
  }
  if (!hists?.length) {
    return { map: out };
  }

  const histById = new Map(
    hists.map((h) => [
      h.id as string,
      h as { id: string; content: string; created_at: string; summary_id: string | null },
    ]),
  );

  type Acc = { id: string; content: string; created_at: string; summary_id: string | null };
  const bestByDoc = new Map<string, Acc>();

  for (const link of links) {
    const hid = link.comparison_history_id as string;
    const docId = link.document_id as string;
    const h = histById.get(hid);
    if (!h) continue;
    const prev = bestByDoc.get(docId);
    const t = new Date(h.created_at).getTime();
    if (!prev || new Date(prev.created_at).getTime() < t) {
      bestByDoc.set(docId, h);
    }
  }

  for (const [docId, h] of bestByDoc) {
    out.set(docId, {
      content: h.content,
      created_at: h.created_at,
      public_id: (h.summary_id ?? h.id) as string,
    });
  }

  return { map: out };
}

export function latestComparisonRowToReadItem(
  row: LatestComparisonFromHistoryRow,
): DocumentSummaryReadItem {
  return {
    id: row.public_id,
    summary_type: "comparison",
    content: sanitizeStoredSummaryForRead(row.content),
    created_at: row.created_at,
    source_ranges: null,
  };
}

/** 두 비교 스냅샷 중 더 최신 `created_at` 을 선택한다. */
export function pickNewerComparisonReadItem(
  a: DocumentSummaryReadItem | null,
  b: DocumentSummaryReadItem | null,
): DocumentSummaryReadItem | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a.created_at) >= new Date(b.created_at) ? a : b;
}
