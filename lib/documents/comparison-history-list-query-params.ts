import type { ComparisonHistoryListRoleFilter } from "@/types/comparisons";

const ROLE_VALUES = new Set<ComparisonHistoryListRoleFilter>([
  "all",
  "primary",
  "peer",
  "secondary",
  "unknown",
]);

/**
 * `GET .../comparisons` 의 `role_filter` 쿼리( 문서 맥락일 때 `current_document_anchor_role` 기준).
 */
export function parseComparisonHistoryListRoleFilter(
  param: string | null | undefined,
  fallback: ComparisonHistoryListRoleFilter = "all",
): ComparisonHistoryListRoleFilter {
  if (param == null || param === "") {
    return fallback;
  }
  if (ROLE_VALUES.has(param as ComparisonHistoryListRoleFilter)) {
    return param as ComparisonHistoryListRoleFilter;
  }
  return fallback;
}
