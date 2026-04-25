import "server-only";

import type { Memo, MemoListItemPayload } from "@/types/memo";
import { MEMO_LIST_CONTENT_PREVIEW_MAX_CHARS } from "@/types/memos";

/** DB/PostgREST 스냅샷이 구버전이어도 list DTO 가 안전하도록. */
export function normalizeMemoRow(row: unknown): Memo {
  const r = row as Memo;
  return {
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : [],
    pinned: r.pinned ?? false,
    bookmarked: r.bookmarked ?? false,
  };
}

/**
 * 목록·검색 응답용: 전체 본문 대신 미리보기( API·RSC 페이로드 축소).
 */
export function mapMemoToListItem(row: Memo): MemoListItemPayload {
  const raw = (row.content ?? "").trim();
  const max = MEMO_LIST_CONTENT_PREVIEW_MAX_CHARS;
  const content_preview = raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
  return {
    id: row.id,
    title: row.title,
    content_preview,
    summary: row.summary,
    source_type: row.source_type,
    project_key: row.project_key,
    tags: row.tags?.length ? [...row.tags] : [],
    sensitivity_flag: row.sensitivity_flag,
    pinned: row.pinned ?? false,
    bookmarked: row.bookmarked ?? false,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapMemosToListItems(rows: unknown[]): MemoListItemPayload[] {
  return rows.map((r) => mapMemoToListItem(normalizeMemoRow(r)));
}
