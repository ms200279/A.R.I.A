import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type { DocumentLatestComparisonPublic, DocumentSummaryReadItem } from "@/types/document";

import {
  fetchHistoryComparisonContextBatchForDocumentIds,
  type HistoryComparisonContextRow,
} from "./comparison-history-read";
import {
  buildComparisonReadPreview,
  tryParseCompareResult,
} from "./parse-stored-document-results";

/**
 * read-side `latest_comparison` — 정책 A(단일 소스):
 *
 * - **의미:** 이 `documentId`가 `comparison_history_documents` 링크 또는 레거시
 *   `document_summaries` (comparison)로 참여한 비교 **중** `created_at`이 가장 늦은 1건.
 * - **primary / peer / secondary:** 히스토리가 있으면 `comparison_history_documents`·`anchor_role`가
 *   소스; `is_primary_context` 는 `documentId === primary_document_id` 로 판정.
 * - **레거시-only:** 히스토리 행이 없고 이 문서에만 매핑된 comparison 요약만 있을 때
 *   `comparison_id`·`current_document_anchor_role` 은 null, `is_primary_context` true.
 * - **병합:** 히스토리 스냅샷 vs 레거시 행 둘 다 있으면 `created_at`이 더 늦은 쪽(동시간이면
 *   히스토리)을 택해 메타가 풍부한 쪽을 유지.
 *
 * `primary_document_id`만 보고 “대표만 latest”로 두지 않는다.
 */

type LegacyCompRow = {
  id: string;
  content: string;
  created_at: string;
};

async function fetchLatestLegacyComparisonByDocumentIds(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
): Promise<Map<string, LegacyCompRow>> {
  const out = new Map<string, LegacyCompRow>();
  if (documentIds.length === 0) {
    return out;
  }
  const { data, error } = await supabase
    .from("document_summaries")
    .select("id,document_id,content,created_at")
    .eq("user_id", userId)
    .eq("summary_type", "comparison")
    .in("document_id", documentIds);

  if (error || !data?.length) {
    return out;
  }
  for (const r of data) {
    const did = r.document_id as string;
    const cur = out.get(did);
    const ca = r.created_at as string;
    const row: LegacyCompRow = {
      id: r.id as string,
      content: r.content as string,
      created_at: ca,
    };
    if (!cur || new Date(ca).getTime() > new Date(cur.created_at).getTime()) {
      out.set(did, row);
    }
  }
  return out;
}

function historyToPublic(
  documentId: string,
  h: HistoryComparisonContextRow,
): DocumentLatestComparisonPublic {
  const sanitized = sanitizeStoredSummaryForRead(h.content);
  return {
    id: h.public_id,
    content: sanitized,
    created_at: h.created_at,
    summary_type: "comparison",
    comparison_id: h.comparison_history_id,
    current_document_anchor_role: h.current_document_anchor_role,
    is_primary_context: documentId === h.primary_document_id,
    related_documents_preview: h.related_documents_preview,
    content_preview: buildComparisonReadPreview(sanitized),
  };
}

function legacyToPublic(_documentId: string, leg: LegacyCompRow): DocumentLatestComparisonPublic {
  const sanitized = sanitizeStoredSummaryForRead(leg.content);
  const parsed = tryParseCompareResult(sanitized);
  const peerIds = parsed?.compared_document_ids ?? [];
  const related_documents_preview =
    peerIds.length > 0 ? peerIds.slice(0, 6).map((id) => id.slice(0, 8)).join(", ") : "—";
  return {
    id: leg.id,
    content: sanitized,
    created_at: leg.created_at,
    summary_type: "comparison",
    comparison_id: null,
    current_document_anchor_role: null,
    is_primary_context: true,
    related_documents_preview,
    content_preview: buildComparisonReadPreview(sanitized),
  };
}

function pickPublic(
  documentId: string,
  hist: HistoryComparisonContextRow | undefined,
  leg: LegacyCompRow | undefined,
): DocumentLatestComparisonPublic | null {
  if (!hist && !leg) return null;
  if (hist && !leg) {
    return historyToPublic(documentId, hist);
  }
  if (!hist && leg) {
    return legacyToPublic(documentId, leg);
  }
  const tH = new Date(hist!.created_at).getTime();
  const tL = new Date(leg!.created_at).getTime();
  if (tH > tL) {
    return historyToPublic(documentId, hist!);
  }
  if (tL > tH) {
    return legacyToPublic(documentId, leg!);
  }
  return historyToPublic(documentId, hist!);
}

export type GetLatestComparisonForDocumentResult = {
  latest: DocumentLatestComparisonPublic | null;
  errorMessages: string[];
};

/**
 * 문서 1건에 대해 `latest_comparison` DTO(또는 null) — 상세/assistant/요약 latest 번들의
 * **유일** 소스. 실패해도 null만 반환하고 상위 read 는 계속.
 */
export async function getLatestComparisonForDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<GetLatestComparisonForDocumentResult> {
  const errors: string[] = [];
  const [hPack, legMap] = await Promise.all([
    fetchHistoryComparisonContextBatchForDocumentIds(supabase, userId, [documentId]),
    fetchLatestLegacyComparisonByDocumentIds(supabase, userId, [documentId]),
  ]);
  if (hPack.errorMessage) {
    errors.push(hPack.errorMessage);
  }
  const hist = hPack.map.get(documentId);
  const leg = legMap.get(documentId);
  return {
    latest: pickPublic(documentId, hist, leg),
    errorMessages: errors,
  };
}

/**
 * 목록 N건용 배치. `documentId`·`userId` 스코프. 개별 id 실패는 빈 엔트리로, 전체 read 는 유지.
 */
export async function getLatestComparisonForDocumentsBatch(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
): Promise<Map<string, DocumentLatestComparisonPublic | null>> {
  const out = new Map<string, DocumentLatestComparisonPublic | null>();
  for (const id of documentIds) {
    out.set(id, null);
  }
  if (documentIds.length === 0) {
    return out;
  }
  const [hPack, legMap] = await Promise.all([
    fetchHistoryComparisonContextBatchForDocumentIds(supabase, userId, documentIds),
    fetchLatestLegacyComparisonByDocumentIds(supabase, userId, documentIds),
  ]);
  for (const id of documentIds) {
    out.set(
      id,
      pickPublic(id, hPack.map.get(id), legMap.get(id)),
    );
  }
  return out;
}

/**
 * `DocumentSummaryReadItem` (summaries API latest 번들)과의 호환 — 동일 `id`·`created_at`·`content`만.
 */
export function mapLatestComparisonPublicToReadItem(
  p: DocumentLatestComparisonPublic,
): DocumentSummaryReadItem {
  return {
    id: p.id,
    summary_type: "comparison",
    content: p.content,
    created_at: p.created_at,
    source_ranges: null,
  };
}
