/**
 * 비교 히스토리 **목록** read-side(클라·서버 공통 라벨·쿼리 구성, DTO 변경 없음).
 * 역할 배지 문구는 `comparison-anchor-role` → 여기는 필터/정렬 옵션 라벨만.
 */
import type {
  ComparisonHistoryListRoleFilter,
  ComparisonHistoryListSort,
} from "@/types/comparisons";

export const comparisonHistoryListSortOptions: { value: ComparisonHistoryListSort; label: string }[] = [
  { value: "created_at_desc", label: "최신순" },
  { value: "created_at_asc", label: "오래된순" },
];

export const comparisonHistoryListFilterOptions: {
  value: ComparisonHistoryListRoleFilter;
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "primary", label: "Primary" },
  { value: "peer", label: "Peer" },
  { value: "secondary", label: "Secondary" },
  { value: "unknown", label: "Unknown" },
];

export function getComparisonHistoryListSortLabel(
  m: ComparisonHistoryListSort,
): string {
  return comparisonHistoryListSortOptions.find((o) => o.value === m)?.label ?? m;
}

export function getComparisonHistoryListFilterLabel(
  m: ComparisonHistoryListRoleFilter,
): string {
  return comparisonHistoryListFilterOptions.find((o) => o.value === m)?.label ?? m;
}

export function buildDocumentComparisonsListSearchParams(
  options: {
    limit: number;
    sort: ComparisonHistoryListSort;
    roleFilter: ComparisonHistoryListRoleFilter;
    cursor: string | null;
  },
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("limit", String(options.limit));
  p.set("sort", options.sort);
  p.set("role_filter", options.roleFilter);
  if (options.cursor) {
    p.set("cursor", options.cursor);
  }
  return p;
}
