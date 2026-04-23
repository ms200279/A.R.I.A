import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logMemoListRead } from "@/lib/logging/audit-log";
import type { Memo } from "@/types/memo";

import { MEMO_ROW_SELECT } from "./memo-columns";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./types";

export type MemoSortField = "created_at" | "updated_at";

export type ListMemosOptions = {
  limit?: number;
  /**
   * 정렬 기준. 기본값 `updated_at` — “최근에 손댄 메모” 우선.
   * `created_at` 은 최초 저장 시각 기준.
   */
  sort?: MemoSortField;
  /** ISO 타임스탬프. 정렬 컬럼 기준으로 이보다 “이전” 페이지를 요청. */
  cursor?: string | null;
  project_key?: string | null;
  /**
   * 감사 로그(성공 시 1회). Route / RSC / assistant 가 선택적으로 전달.
   * 전달하지 않으면 로그를 남기지 않는다.
   */
  audit?: {
    actor_id: string;
    actor_email?: string | null;
    source: "api" | "rsc" | "assistant";
  };
};

export type ListMemosResult = {
  items: Memo[];
  next_cursor: string | null;
  sort: MemoSortField;
};

export async function listMemos(
  options: ListMemosOptions = {},
): Promise<ListMemosResult> {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT,
  );
  const sort: MemoSortField = options.sort ?? "updated_at";

  const supabase = await createClient();

  let query = supabase
    .from("memos")
    .select(MEMO_ROW_SELECT)
    .eq("status", "active")
    .order(sort, { ascending: false })
    .limit(limit + 1);

  if (options.cursor) {
    query = query.lt(sort, options.cursor);
  }
  if (options.project_key) {
    query = query.eq("project_key", options.project_key);
  }

  const { data, error } = await query;
  if (error || !data) {
    const empty: ListMemosResult = {
      items: [],
      next_cursor: null,
      sort,
    };
    if (options.audit) {
      await logMemoListRead({
        actor_id: options.audit.actor_id,
        actor_email: options.audit.actor_email ?? null,
        source: options.audit.source,
        result_count: 0,
        sort,
        has_cursor: Boolean(options.cursor),
        project_key: options.project_key ?? null,
      });
    }
    return empty;
  }

  const rows = data as Memo[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.length > 0 ? items[items.length - 1] : undefined;
  const next_cursor =
    hasMore && last ? (last[sort] as string) : null;

  if (options.audit) {
    await logMemoListRead({
      actor_id: options.audit.actor_id,
      actor_email: options.audit.actor_email ?? null,
      source: options.audit.source,
      result_count: items.length,
      sort,
      has_cursor: Boolean(options.cursor),
      project_key: options.project_key ?? null,
    });
  }

  return { items, next_cursor, sort };
}
