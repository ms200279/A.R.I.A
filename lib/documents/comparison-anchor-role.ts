import type { ComparisonAnchorRole } from "@/types/document";

/**
 * DB `comparison_history_documents.anchor_role` 및 DTO `ComparisonAnchorRole` 와 정렬.
 * read-side에서만 사용; 쓰기(비교 저장)는 `save-comparison-history`가 primary/peer를 강제할 수 있음.
 */
export const COMPARISON_ANCHOR_ROLES = ["primary", "peer", "secondary"] as const;

export function isComparisonAnchorRoleString(value: string): value is ComparisonAnchorRole {
  return (COMPARISON_ANCHOR_ROLES as readonly string[]).includes(value);
}

/**
 * read-side: 스키마·레거시 문자열 → DTO. 비정규 값은 `null` + (개발할 때만) 경고.
 * production 에서 log throw 없음.
 */
export function normalizeComparisonAnchorRole(
  raw: string | null | undefined,
): ComparisonAnchorRole | null {
  const s = raw?.trim() ?? "";
  if (s === "") {
    return null;
  }
  if (isComparisonAnchorRoleString(s)) {
    return s;
  }
  devWarnNonCanonicalAnchorRole(s);
  return null;
}

function devWarnNonCanonicalAnchorRole(raw: string): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  try {
    console.warn(
      "[comparison_anchor_role] non-canonical anchor_role; normalized to null for read",
      { raw, allowed: COMPARISON_ANCHOR_ROLES },
    );
  } catch {
    /* ignore */
  }
}

/**
 * UI 스타일 티어(라벨 문구는 `comparisonAnchorRoleBadgeLabel` 과 동기).
 * primary=강조, supporting=peer/secondary, unknown=null/정규화 실패.
 */
export type ComparisonAnchorRoleUiTier = "primary" | "supporting" | "unknown";

export function comparisonAnchorRoleUiTier(
  role: ComparisonAnchorRole | null,
): ComparisonAnchorRoleUiTier {
  if (role === "primary") {
    return "primary";
  }
  if (role === "peer" || role === "secondary") {
    return "supporting";
  }
  return "unknown";
}

export type ComparisonAnchorRoleBadgeResult =
  | { kind: "known"; role: ComparisonAnchorRole; label: string }
  | { kind: "unknown"; label: string };

/** null / 비정규(정규화 후) → `kind: unknown`, 라벨은 Primary/Peer/Secondary/Unknown 정합. */
export function comparisonAnchorRoleBadgeLabel(
  role: ComparisonAnchorRole | null,
): ComparisonAnchorRoleBadgeResult {
  if (role === "primary") {
    return { kind: "known", role, label: "Primary" };
  }
  if (role === "peer") {
    return { kind: "known", role, label: "Peer" };
  }
  if (role === "secondary") {
    return { kind: "known", role, label: "Secondary" };
  }
  return { kind: "unknown", label: "Unknown" };
}
