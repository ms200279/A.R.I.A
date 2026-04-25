/**
 * 메모 도메인 공용 타입.
 * DB 스키마의 snake_case 필드명을 그대로 유지한다.
 *
 * - `Memo` — read-side / DB 1:1( 전체 본문 포함). 상세·요약·서버 처리.
 * - `MemoListItemPayload` — 목록·검색 API: 본문 대신 `content_preview` 만( 장기 저장 메모 **식별**용).
 * - 세션(대화) 임시 상태와 섞이지 않도록 UI/API에서 명시한다.
 */

export type MemoSourceType = "quick_capture" | "chat" | "import";
export type MemoStatus = "active" | "archived";

export type Memo = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  summary: string | null;
  source_type: MemoSourceType;
  project_key: string | null;
  /** 짧은 태그( read-side, 승인 payload와 동기 ). */
  tags: string[];
  sensitivity_flag: boolean;
  /** 목록 정렬·표시( read-side 편의, 승인과 무관 ). */
  pinned: boolean;
  bookmarked: boolean;
  status: MemoStatus;
  created_at: string;
  updated_at: string;
};

/**
 * `GET /api/memos` · `GET /api/memos/search` 항목( 전체 `content` 없음).
 * - title 이 비면 UI 는 `content_preview` 첫 줄 기반 `displayMemoListTitle` ( lib/memos/display ).
 * - 전체 본문(`content`)은 **포함하지 않음** — preview 길이는 `types/memos` 의 `MEMO_LIST_CONTENT_PREVIEW_MAX_CHARS` 와 `map-memo-dto` 가 일치.
 * - 향후 "제목만 노출" read-side 옵션이 있으면 `content_preview` 를 비울 수 있음(미구현).
 */
export type MemoListItemPayload = {
  id: string;
  title: string | null;
  content_preview: string;
  summary: string | null;
  source_type: MemoSourceType;
  project_key: string | null;
  tags: string[];
  sensitivity_flag: boolean;
  pinned: boolean;
  bookmarked: boolean;
  status: MemoStatus;
  created_at: string;
  updated_at: string;
};

/** `GET /api/memos/[id]` 본문. */
export type MemoDetailPayload = Memo;

/** `GET /api/memos/search` 응답( read-side DTO). */
export type MemoSearchResponse = {
  items: MemoListItemPayload[];
  query: string;
};
