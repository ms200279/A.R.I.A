/**
 * GET document_summaries 조회용 상한·쿼리 파싱.
 */

import type { DocumentSummaryType } from "@/types/document";

export const DOCUMENT_SUMMARIES_LIST_DEFAULT_LIMIT = 30;
export const DOCUMENT_SUMMARIES_LIST_MAX_LIMIT = 100;

export type DocumentSummariesTypeQuery = DocumentSummaryType | "all";

const TYPE_QUERY_VALUES = new Set<string>([
  "summary",
  "comparison",
  "analysis",
  "all",
]);

export function isValidDocumentSummariesTypeQuery(
  raw: string | null,
): raw is DocumentSummariesTypeQuery {
  return raw !== null && TYPE_QUERY_VALUES.has(raw);
}

export function parseDocumentSummariesLimit(
  raw: string | null,
  fallback: number,
): { ok: true; limit: number } | { ok: false } {
  if (raw === null || raw === "") {
    return { ok: true, limit: fallback };
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > DOCUMENT_SUMMARIES_LIST_MAX_LIMIT) {
    return { ok: false };
  }
  return { ok: true, limit: n };
}
