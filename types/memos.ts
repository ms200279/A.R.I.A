/**
 * 메모 read-side / API 계약( DTO ). DB Row(`Memo`) 정의는 `types/memo`.
 * 이 파일이 목록·검색·GET /api/memos 응답 shape 의 기준.
 */

import type { MemoListItemPayload } from "./memo";

export type { MemoDetailPayload, MemoListItemPayload, MemoSearchResponse } from "./memo";

/** `map-memo-dto` · assistant preview와 동일 상한( 본문 전체 미노출 ). */
export const MEMO_LIST_CONTENT_PREVIEW_MAX_CHARS = 520;

/** assistant `projectMemoForModel` 가 넘기는 `preview` 상한( 전체 본문 금지 ). */
export const ASSISTANT_MEMO_MODEL_PREVIEW_MAX_CHARS = 200;

/** 목록용 제목이 없을 때 `displayMemoListTitle` 가 쓰는 본문/미리보기 첫 줄 상한( `lib/memos/display` ). */
export const MEMO_LIST_TITLE_FALLBACK_MAX_CHARS = 120;

export const MEMO_TAGS_MAX_COUNT = 30;
export const MEMO_TAG_MAX_CHARS = 64;

export type MemoSortFieldApi = "created_at" | "updated_at";

/**
 * `GET /api/memos` 응답 본문( `app/api/memos/route.ts` 가 이 형태로만 반환).
 * cursor 기반 키셋 대신 `offset` 페이지( 핀·북마크 정렬과 호환).
 */
export type MemoListPageInfo = {
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
};

export type MemoListApiResponse = {
  items: MemoListItemPayload[];
  sort: MemoSortFieldApi;
  page: MemoListPageInfo;
};
