/**
 * 내부 comparison 상세 딥링크( 동일 origin, 로그인·소유 RSC/API 검증 전제 ).
 * 외부 공개 토큰·public route 없음.
 */
export function getComparisonDetailPath(
  comparisonId: string,
  fromDocumentId: string | null | undefined,
): string {
  const from = (fromDocumentId ?? "").trim();
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  const q = p.toString();
  return q ? `/comparisons/${comparisonId}?${q}` : `/comparisons/${comparisonId}`;
}

export function getComparisonDetailAbsoluteUrl(
  origin: string,
  comparisonId: string,
  fromDocumentId: string | null | undefined,
): string {
  const path = getComparisonDetailPath(comparisonId, fromDocumentId);
  return `${origin.replace(/\/$/, "")}${path}`;
}
