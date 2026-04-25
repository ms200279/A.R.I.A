import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type {
  DocumentLatestComparisonPublic,
  DocumentLatestSummaryPublic,
  DocumentSummaryReadItem,
  DocumentSummaryType,
} from "@/types/document";

import {
  getLatestComparisonForDocument,
  mapLatestComparisonPublicToReadItem,
} from "./get-latest-comparison-for-document";

type SummaryRowDb = {
  id: string;
  summary_type: DocumentSummaryType;
  content: string;
  source_ranges: Record<string, unknown> | null;
  created_at: string;
};

function mapRow(row: SummaryRowDb): DocumentSummaryReadItem {
  return {
    id: row.id,
    summary_type: row.summary_type,
    content: sanitizeStoredSummaryForRead(row.content),
    created_at: row.created_at,
    source_ranges: row.source_ranges,
  };
}

export async function loadLatestSummaryReadOneForUser(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  summaryType: DocumentSummaryType,
): Promise<DocumentSummaryReadItem | null> {
  const r = await fetchLatestOne(supabase, documentId, userId, summaryType);
  return r.item;
}

async function fetchLatestOne(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  summaryType: DocumentSummaryType,
): Promise<{ item: DocumentSummaryReadItem | null; errorMessage?: string }> {
  const { data, error } = await supabase
    .from("document_summaries")
    .select("id,summary_type,content,source_ranges,created_at")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .eq("summary_type", summaryType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { item: null, errorMessage: error.message };
  }
  if (!data) {
    return { item: null };
  }
  return { item: mapRow(data as SummaryRowDb) };
}

export type LatestSummaryReadTriplet = {
  summary: DocumentSummaryReadItem | null;
  /** `document_summaries` 호환 read 조각(요약 API latest 번들). */
  comparison: DocumentSummaryReadItem | null;
  /** 상세/동일 정책 DTO(있으면 `comparison`과 id·content·created_at 가 일치). */
  comparison_public: DocumentLatestComparisonPublic | null;
  analysis: DocumentSummaryReadItem | null;
  /** 각 타입별 SELECT 실패 메시지(없으면 해당 타입은 null). */
  fetchErrors: string[];
};

/**
 * 소유권이 이미 검증된 컨텍스트에서, 타입별 최신 `document_summaries` 1건씩을 불러온다.
 * `list-document-summaries`·상세 DTO·기타 read 경로에서 공통으로 사용한다.
 */
export async function loadLatestSummaryReadTripletForUser(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<LatestSummaryReadTriplet> {
  const [rs, compRes, ra] = await Promise.all([
    fetchLatestOne(supabase, documentId, userId, "summary"),
    getLatestComparisonForDocument(supabase, documentId, userId),
    fetchLatestOne(supabase, documentId, userId, "analysis"),
  ]);
  const comparison_public = compRes.latest;
  const comparison = comparison_public
    ? mapLatestComparisonPublicToReadItem(comparison_public)
    : null;
  const fetchErrors = [
    rs.errorMessage,
    compRes.errorMessages.length
      ? compRes.errorMessages.join("; ")
      : undefined,
    ra.errorMessage,
  ].filter((m): m is string => Boolean(m));
  return {
    summary: rs.item,
    comparison,
    comparison_public,
    analysis: ra.item,
    fetchErrors,
  };
}

/** 상세/assistant용: source_ranges 제외 공개 조각. */
export function mapSummaryReadItemToLatestPublic(
  item: DocumentSummaryReadItem | null | undefined,
): DocumentLatestSummaryPublic | null {
  if (!item) return null;
  return {
    id: item.id,
    content: item.content,
    created_at: item.created_at,
    summary_type: item.summary_type,
  };
}
