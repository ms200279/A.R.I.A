import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type { ComparisonAnchorRole, DocumentSummaryReadItem } from "@/types/document";

import { normalizeComparisonAnchorRole } from "./comparison-anchor-role";
import { normalizeEmbeddedDocumentMeta } from "./supabase-embed-doc";

/**
 * `comparison_histories` 기준 “이 문서가 참여한 비교” 중 `created_at`이 가장 늦은 1건의 메타.
 * `primary_document_id`는 히스토리 행의 대표(레거시 앵커) 필드 — 정책 A에서 peer도 동일 히스토리를
 * `latest`로 쓰므로, `is_primary_context`는 `documentId === primary_document_id`로 별도 계산한다.
 */
export type HistoryComparisonContextRow = {
  content: string;
  created_at: string;
  /** UI·DTO·레거시와 맞는 공개 id: `summary_id`가 있으면 그것, 없으면 `comparison_history_id` */
  public_id: string;
  comparison_history_id: string;
  primary_document_id: string;
  current_document_anchor_role: ComparisonAnchorRole | null;
  related_documents_preview: string;
};

export type LatestComparisonFromHistoryRow = {
  content: string;
  created_at: string;
  /** UI·DTO용 공개 id: summary_id 우선, 없으면 히스토리 id */
  public_id: string;
};

type HistRow = {
  id: string;
  content: string;
  created_at: string;
  summary_id: string | null;
  primary_document_id: string;
};

type BestForDoc = {
  docId: string;
  h: HistRow;
  own_anchor: string | null;
};

/**
 * 문서 id가 참여한 비교 히스토리 중 `created_at` 최신 1건(내용 스냅샷) — 기존 얇은 DTO.
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
 * 여러 문서에 대해, 각 문서가 참여한 비교 중 최신 스냅샷(히스토리 기준) — 기존 얇은 DTO.
 */
export async function fetchLatestComparisonBatchForDocumentIds(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
): Promise<{
  map: Map<string, LatestComparisonFromHistoryRow>;
  errorMessage?: string;
}> {
  const { map: rich, errorMessage } = await fetchHistoryComparisonContextBatchForDocumentIds(
    supabase,
    userId,
    documentIds,
  );
  const map = new Map<string, LatestComparisonFromHistoryRow>();
  for (const [docId, row] of rich) {
    map.set(docId, {
      content: row.content,
      created_at: row.created_at,
      public_id: row.public_id,
    });
  }
  return { map, errorMessage };
}

/**
 * read-side `latest_comparison` 정책(정책 A) — 히스토리·앵커 조인이 소스. 동일 `document_id`에
 * 여러 링크가 있어도, 해당 문서 관점에서 `created_at`이 가장 늦은 비교 1건만 쓴다.
 */
export async function fetchHistoryComparisonContextBatchForDocumentIds(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
): Promise<{
  map: Map<string, HistoryComparisonContextRow>;
  errorMessage?: string;
}> {
  const out = new Map<string, HistoryComparisonContextRow>();
  if (documentIds.length === 0) {
    return { map: out };
  }

  const { data: links, error: linkErr } = await supabase
    .from("comparison_history_documents")
    .select("comparison_history_id, document_id, anchor_role")
    .in("document_id", documentIds)
    .eq("user_id", userId);

  if (linkErr) {
    return { map: out, errorMessage: linkErr.message };
  }
  if (!links?.length) {
    return { map: out };
  }

  const ownAnchorByKey = new Map<string, string | null>();
  for (const l of links) {
    const hid = l.comparison_history_id as string;
    const docId = l.document_id as string;
    ownAnchorByKey.set(`${docId}::${hid}`, (l.anchor_role as string) ?? null);
  }

  const hidSet = new Set(links.map((l) => l.comparison_history_id as string));
  const { data: hists, error: histErr } = await supabase
    .from("comparison_histories")
    .select("id, content, created_at, summary_id, primary_document_id")
    .in("id", [...hidSet])
    .eq("user_id", userId);

  if (histErr) {
    return { map: out, errorMessage: histErr.message };
  }
  if (!hists?.length) {
    return { map: out };
  }

  const histById = new Map(
    hists.map((h) => [h.id as string, h as unknown as HistRow]),
  );

  const bestByDoc = new Map<string, BestForDoc>();
  for (const l of links) {
    const hid = l.comparison_history_id as string;
    const docId = l.document_id as string;
    const h = histById.get(hid);
    if (!h) continue;
    const t = new Date(h.created_at).getTime();
    const prev = bestByDoc.get(docId);
    if (!prev || new Date(prev.h.created_at).getTime() < t) {
      const anchorKey = ownAnchorByKey.get(`${docId}::${hid}`) ?? null;
      bestByDoc.set(docId, { docId, h, own_anchor: anchorKey });
    }
  }

  const needHistIds = [...new Set([...bestByDoc.values().map((b) => b.h.id)])];
  if (needHistIds.length === 0) {
    return { map: out };
  }

  const { data: anchorRows, error: anchorErr } = await supabase
    .from("comparison_history_documents")
    .select("comparison_history_id, document_id, documents(title, file_name)")
    .in("comparison_history_id", needHistIds)
    .eq("user_id", userId);

  if (anchorErr) {
    return { map: out, errorMessage: anchorErr.message };
  }

  type AnchorLink = {
    comparison_history_id: string;
    document_id: string;
    documents: unknown;
  };
  const anchorByHist = new Map<string, AnchorLink[]>();
  for (const a of anchorRows ?? []) {
    const al = a as unknown as AnchorLink;
    const hid = al.comparison_history_id;
    if (!anchorByHist.has(hid)) anchorByHist.set(hid, []);
    anchorByHist.get(hid)!.push(al);
  }

  for (const [, best] of bestByDoc) {
    const { docId, h, own_anchor } = best;
    const hid = h.id;
    const alist = anchorByHist.get(hid) ?? [];
    const others = alist.filter((x) => (x.document_id as string) !== docId);
    const labels = others.map((x) => {
      const doc = normalizeEmbeddedDocumentMeta(x.documents);
      const idShort = (x.document_id as string).slice(0, 8);
      return doc?.title?.trim() || doc?.file_name || idShort;
    });
    const related_documents_preview = labels.join(", ") || "—";
    const rawContent = h.content;

    const public_id = (h.summary_id ?? h.id) as string;
    out.set(docId, {
      content: rawContent,
      created_at: h.created_at,
      public_id,
      comparison_history_id: hid,
      primary_document_id: h.primary_document_id,
      current_document_anchor_role: normalizeComparisonAnchorRole(own_anchor),
      related_documents_preview,
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

/** 두 비교 스냅샷 중 더 최신 `created_at` 을 선택한다. (레거시·히스토리 merge 시) */
export function pickNewerComparisonReadItem(
  a: DocumentSummaryReadItem | null,
  b: DocumentSummaryReadItem | null,
): DocumentSummaryReadItem | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a.created_at) >= new Date(b.created_at) ? a : b;
}
