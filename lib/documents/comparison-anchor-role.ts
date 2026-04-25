import type { ComparisonAnchorRole } from "@/types/document";

/**
 * comparison_history_documents.anchor_role 정규화.
 * 스키마 외 값·레거시 행은 null (UI에서 fallback).
 */
export function normalizeComparisonAnchorRole(
  raw: string | null | undefined,
): ComparisonAnchorRole | null {
  if (raw === "primary" || raw === "peer") {
    return raw;
  }
  return null;
}

/** 목록·상세·카드에서 동일 라벨 재사용. */
export function comparisonAnchorRoleBadgeLabel(
  role: ComparisonAnchorRole | null,
): { kind: "known"; role: ComparisonAnchorRole; label: string } | { kind: "unknown"; label: string } {
  if (role === "primary") {
    return { kind: "known", role, label: "Primary" };
  }
  if (role === "peer") {
    return { kind: "known", role, label: "Peer" };
  }
  return { kind: "unknown", label: "역할 미상" };
}
