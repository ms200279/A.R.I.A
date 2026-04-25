import "server-only";

import type { ComparisonHistoryListSort } from "@/types/comparisons";

/**
 * 키셋: `ORDER BY created_at (asc|desc), id (asc|desc)` 이 동일할 때
 * 동일 `created_at`의 행이 섞이지 않도록 `id`로 tie-breaker.
 * @see listComparisonHistoriesPage
 */

const CURSOR_V = 1 as const;

export type ComparisonListCursorPayload = {
  v: typeof CURSOR_V;
  created_at: string;
  id: string;
  sort: ComparisonHistoryListSort;
};

export function encodeComparisonListCursor(payload: ComparisonListCursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

/**
 * 쿼리 `sort` 파싱(인식 못 하면 `fallback`, 보통 `created_at_desc`).
 */
export function parseComparisonHistoryListSort(
  param: string | null | undefined,
  fallback: ComparisonHistoryListSort = "created_at_desc",
): ComparisonHistoryListSort {
  if (param === "created_at_asc" || param === "created_at_desc") {
    return param;
  }
  return fallback;
}

/**
 * 첫 페이지: `raw`가 없으면 `null` (400 아님).
 * 이후: 복호 못 하면 `null` → route 가 `invalid_cursor` 400.
 */
export function decodeComparisonListCursor(raw: string | null | undefined): ComparisonListCursorPayload | null {
  if (raw == null || raw === "") {
    return null;
  }
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (r.v !== CURSOR_V) return null;
    if (typeof r.created_at !== "string" || typeof r.id !== "string" || typeof r.sort !== "string") {
      return null;
    }
    if (r.sort !== "created_at_asc" && r.sort !== "created_at_desc") {
      return null;
    }
    return {
      v: CURSOR_V,
      created_at: r.created_at,
      id: r.id,
      sort: r.sort,
    };
  } catch {
    return null;
  }
}

/**
 * `sort` 가 커서에 기록된 것과 다르면 잘못된 요청(다른 정렬이면 커서 무효).
 */
export function cursorMatchesRequestSort(
  c: ComparisonListCursorPayload,
  requestSort: ComparisonHistoryListSort,
): boolean {
  return c.sort === requestSort;
}

/**
 * PostgREST `or` — 키셋(created_at, id) 기준.
 * - desc(최신 먼저): 다음 페이지 = 더 **오래된** 행 → (ca,id) **보다 작다**.
 * - asc(과거 먼저): 다음 페이지 = 더 **최신** 행 → (ca,id) **보다 크다**.
 */
export function buildKeysetOrFilter(
  createdAt: string,
  id: string,
  order: "desc" | "asc",
): string {
  const qTs = quoteValue(createdAt);
  const qId = quoteValue(id);
  if (order === "desc") {
    return `and(created_at.eq.${qTs},id.lt.${qId}),created_at.lt.${qTs}`;
  }
  return `and(created_at.eq.${qTs},id.gt.${qId}),created_at.gt.${qTs}`;
}

/**
 * PostgREST 문자열 인용(문자/UUID/timestamp 공통). 이스케이프는 최소(제어·따옴표).
 */
function quoteValue(s: string): string {
  const safe = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${safe}"`;
}

export function parseComparisonHistoryLimitParam(
  raw: string | null,
  defaultLimit: number,
  max: number,
): number | "invalid" {
  if (raw == null || raw === "") {
    return defaultLimit;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > max) {
    return "invalid";
  }
  return n;
}
