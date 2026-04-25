import { MEMO_LIST_TITLE_FALLBACK_MAX_CHARS } from "@/types/memos";

/**
 * 클라이언트 컴포넌트에서도 사용 가능. (`lib/memos/index.ts` 는 `server-only` 이므로
 * 이 파일을 직접 import 할 것.)
 *
 * 목록·어시스턴트 도구에서 공통으로 쓰는 표시용 제목.
 * title 이 비어 있으면 본문 첫 비어 있지 않은 줄을 사용한다.
 */
function truncateTitleLine(line: string): string {
  const max = MEMO_LIST_TITLE_FALLBACK_MAX_CHARS;
  return line.length > max ? `${line.slice(0, max - 3)}…` : line;
}

export function displayMemoTitle(memo: { title: string | null; content: string }): string {
  const t = (memo.title ?? "").trim();
  if (t) return t;
  const first = (memo.content ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!first) return "(제목 없음)";
  return truncateTitleLine(first);
}

/** 목록 DTO(`content_preview`)용 — 전체 본문 없이 표시 제목만 유도. */
export function displayMemoListTitle(memo: {
  title: string | null;
  content_preview: string;
}): string {
  const t = (memo.title ?? "").trim();
  if (t) return t;
  const first = (memo.content_preview ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!first) return "(제목 없음)";
  return truncateTitleLine(first);
}
