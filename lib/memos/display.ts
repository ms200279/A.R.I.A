/**
 * 클라이언트 컴포넌트에서도 사용 가능. (`lib/memos/index.ts` 는 `server-only` 이므로
 * 이 파일을 직접 import 할 것.)
 *
 * 목록·어시스턴트 도구에서 공통으로 쓰는 표시용 제목.
 * title 이 비어 있으면 본문 첫 비어 있지 않은 줄을 사용한다.
 */
export function displayMemoTitle(memo: {
  title: string | null;
  content: string;
}): string {
  const t = (memo.title ?? "").trim();
  if (t) return t;
  const first = (memo.content ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!first) return "(제목 없음)";
  return first.length > 120 ? `${first.slice(0, 117)}…` : first;
}
