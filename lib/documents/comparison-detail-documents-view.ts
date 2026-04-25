/**
 * 비교 상세「포함 문서」read-side 정렬·필터( pure ). DTO 의미/스키마는 바꾸지 않는다.
 * 역할 배지/스타일은 `comparison-anchor-role` ( `comparisonAnchorRoleBadgeLabel` / `uiTier` ) 와 별도로,
 * 정렬 `role_priority` 는 primary → peer → secondary → unknown 만 고정한다.
 */
import type {
  ComparisonAnchorRole,
  ComparisonDetailDocumentsFilterMode,
  ComparisonDetailDocumentsSortMode,
  ComparisonHistoryDetailPayload,
} from "@/types/comparisons";

export type ComparisonDetailDocumentItem =
  ComparisonHistoryDetailPayload["documents"][number];

const DEFAULT_LOCALE = "ko";

/** `sort_order` / 제목 / 파일명 / id 축약 으로 표시용·정렬 키( 상세/목록 UI 공통). */
export function getComparisonDocumentDisplayLabel(
  doc: ComparisonDetailDocumentItem,
): string {
  const t = doc.title?.trim();
  if (t) return t;
  const f = doc.file_name?.trim();
  if (f) return f;
  return doc.id.length > 8 ? `${doc.id.slice(0, 8)}…` : doc.id;
}

/**
 * `anchor_role` null·레거시·없는 값 → `unknown` 버킷( 필터/정렬·badge unknown 과 일치).
 */
export function getComparisonDocumentFilterBucket(
  anchor_role: ComparisonAnchorRole | null,
): Exclude<ComparisonDetailDocumentsFilterMode, "all"> {
  if (anchor_role === "primary" || anchor_role === "peer" || anchor_role === "secondary") {
    return anchor_role;
  }
  return "unknown";
}

/**
 * `role_priority` 정렬: primary(0) → peer(1) → secondary(2) → unknown(3).
 */
export function getComparisonDocumentRoleSortIndex(
  anchor_role: ComparisonAnchorRole | null,
): number {
  if (anchor_role === "primary") return 0;
  if (anchor_role === "peer") return 1;
  if (anchor_role === "secondary") return 2;
  return 3;
}

function numericSortOrder(doc: ComparisonDetailDocumentItem): number {
  const n = doc.sort_order;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function compareByDisplayLabel(
  a: ComparisonDetailDocumentItem,
  b: ComparisonDetailDocumentItem,
  dir: "asc" | "desc",
): number {
  const ca = getComparisonDocumentDisplayLabel(a);
  const cb = getComparisonDocumentDisplayLabel(b);
  const cmp = ca.localeCompare(cb, DEFAULT_LOCALE, { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

/**
 * @param source 원본( 변경하지 않음)
 * @returns 정렬된 새 배열
 */
export function applyComparisonDetailDocumentSort(
  source: readonly ComparisonDetailDocumentItem[],
  mode: ComparisonDetailDocumentsSortMode,
): ComparisonDetailDocumentItem[] {
  const out = [...source];
  if (mode === "sort_order_default") {
    out.sort((a, b) => {
      const so = numericSortOrder(a) - numericSortOrder(b);
      if (so !== 0) return so;
      return compareByDisplayLabel(a, b, "asc");
    });
    return out;
  }
  if (mode === "title_asc") {
    out.sort((a, b) => compareByDisplayLabel(a, b, "asc"));
    return out;
  }
  if (mode === "title_desc") {
    out.sort((a, b) => compareByDisplayLabel(a, b, "desc"));
    return out;
  }
  /* role_priority */
  out.sort((a, b) => {
    const ra = getComparisonDocumentRoleSortIndex(a.anchor_role);
    const rb = getComparisonDocumentRoleSortIndex(b.anchor_role);
    if (ra !== rb) return ra - rb;
    const so = numericSortOrder(a) - numericSortOrder(b);
    if (so !== 0) return so;
    return compareByDisplayLabel(a, b, "asc");
  });
  return out;
}

/**
 * @param source 원본( 변경하지 않음)
 * @returns 필터된 새 배열. `all` 은 복사본.
 */
export function applyComparisonDetailDocumentFilter(
  source: readonly ComparisonDetailDocumentItem[],
  mode: ComparisonDetailDocumentsFilterMode,
): ComparisonDetailDocumentItem[] {
  if (mode === "all") {
    return [...source];
  }
  return source.filter(
    (d) => getComparisonDocumentFilterBucket(d.anchor_role) === mode,
  );
}

/** sort + filter( 필터 먼저 → 정렬). */
export function getComparisonDetailDocumentsViewList(
  source: readonly ComparisonDetailDocumentItem[],
  filterMode: ComparisonDetailDocumentsFilterMode,
  sortMode: ComparisonDetailDocumentsSortMode,
): ComparisonDetailDocumentItem[] {
  const filtered = applyComparisonDetailDocumentFilter(source, filterMode);
  return applyComparisonDetailDocumentSort(filtered, sortMode);
}

export const defaultComparisonDetailDocumentsSortMode: ComparisonDetailDocumentsSortMode =
  "sort_order_default";

export const defaultComparisonDetailDocumentsFilterMode: ComparisonDetailDocumentsFilterMode =
  "all";
