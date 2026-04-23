import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type { ComparisonHistoryListItemPayload } from "@/types/document";

import { normalizeEmbeddedDocumentMeta } from "./supabase-embed-doc";

const CONTENT_PREVIEW_MAX = 160;
export const DEFAULT_DOCUMENT_COMPARISONS_LIMIT = 20;
export const MAX_DOCUMENT_COMPARISONS_LIMIT = 50;

export type ListDocumentComparisonsContext = {
  user_id: string;
};

/**
 * 특정 문서가 참여한 비교 히스토리 목록(최신순).
 */
export async function listDocumentComparisons(
  supabase: SupabaseClient,
  documentId: string,
  ctx: ListDocumentComparisonsContext,
  options?: { limit?: number },
): Promise<ComparisonHistoryListItemPayload[]> {
  const limit = Math.min(
    Math.max(options?.limit ?? DEFAULT_DOCUMENT_COMPARISONS_LIMIT, 1),
    MAX_DOCUMENT_COMPARISONS_LIMIT,
  );

  const { data: links } = await supabase
    .from("comparison_history_documents")
    .select("comparison_history_id")
    .eq("document_id", documentId)
    .eq("user_id", ctx.user_id);

  const hids = [...new Set(links?.map((l) => l.comparison_history_id as string) ?? [])];
  if (!hids.length) return [];

  const { data: hists } = await supabase
    .from("comparison_histories")
    .select("id, summary_id, primary_document_id, created_at, content")
    .in("id", hids)
    .eq("user_id", ctx.user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!hists?.length) return [];

  const rowIds = hists.map((h) => h.id as string);
  const { data: anchors } = await supabase
    .from("comparison_history_documents")
    .select("comparison_history_id, document_id, documents(title, file_name)")
    .in("comparison_history_id", rowIds)
    .eq("user_id", ctx.user_id);

  type AnchorLink = {
    comparison_history_id: string;
    document_id: string;
    documents: unknown;
  };
  const anchorByHist = new Map<string, AnchorLink[]>();
  for (const a of anchors ?? []) {
    const hid = a.comparison_history_id as string;
    if (!anchorByHist.has(hid)) anchorByHist.set(hid, []);
    anchorByHist.get(hid)!.push(a);
  }

  return hists.map((h) => {
    const hid = h.id as string;
    const alist = anchorByHist.get(hid) ?? [];
    const others = alist.filter((x) => (x.document_id as string) !== documentId);
    const labels = others.map((x) => {
      const doc = normalizeEmbeddedDocumentMeta(x.documents);
      const idShort = (x.document_id as string).slice(0, 8);
      return doc?.title?.trim() || doc?.file_name || idShort;
    });
    const rawContent = h.content as string;
    const sanitized = sanitizeStoredSummaryForRead(rawContent);
    const content_preview =
      sanitized.length > CONTENT_PREVIEW_MAX
        ? `${sanitized.slice(0, CONTENT_PREVIEW_MAX - 1)}…`
        : sanitized;

    return {
      comparison_id: hid,
      summary_id: (h.summary_id as string | null) ?? null,
      primary_document_id: h.primary_document_id as string,
      created_at: h.created_at as string,
      document_count: alist.length,
      other_documents_preview: labels.join(", ") || "—",
      content_preview,
    };
  });
}
