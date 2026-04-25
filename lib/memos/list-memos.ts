import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logMemoListRead } from "@/lib/logging/audit-log";
import type { MemoListItemPayload } from "@/types/memo";
import type { MemoListPageInfo } from "@/types/memos";

import { MEMO_ROW_SELECT } from "./memo-columns";
import { mapMemosToListItems } from "./map-memo-dto";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./types";

export type MemoSortField = "created_at" | "updated_at";

export type ListMemosOptions = {
  limit?: number;
  /**
   * 0 기반 오프셋. `page.next_offset` 과 대응.
   */
  offset?: number;
  /**
   * 정렬 기준. 기본값 `updated_at` — “최근에 손댄 메모” 우선.
   * `created_at` 은 최초 저장 시각 기준.
   * 핀·북마크는 항상 해당 정렬보다 우선한다.
   */
  sort?: MemoSortField;
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
  items: MemoListItemPayload[];
  sort: MemoSortField;
  page: MemoListPageInfo;
};

export async function listMemos(options: ListMemosOptions = {}): Promise<ListMemosResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const sort: MemoSortField = options.sort ?? "updated_at";
  const offset = Math.max(0, options.offset ?? 0);

  const supabase = await createClient();

  let query = supabase
    .from("memos")
    .select(MEMO_ROW_SELECT)
    .eq("status", "active")
    .order("pinned", { ascending: false })
    .order("bookmarked", { ascending: false })
    .order(sort, { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (options.project_key) {
    query = query.eq("project_key", options.project_key);
  }

  const { data, error } = await query;
  const emptyPage = (): MemoListPageInfo => ({
    limit,
    offset,
    has_more: false,
    next_offset: null,
  });

  if (error) {
    const result: ListMemosResult = {
      items: [],
      sort,
      page: emptyPage(),
    };
    if (options.audit) {
      await logMemoListRead({
        actor_id: options.audit.actor_id,
        actor_email: options.audit.actor_email ?? null,
        source: options.audit.source,
        result_count: 0,
        sort,
        offset,
        project_key: options.project_key ?? null,
      });
    }
    return result;
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = mapMemosToListItems(pageRows);
  const page: MemoListPageInfo = {
    limit,
    offset,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
  };

  if (options.audit) {
    await logMemoListRead({
      actor_id: options.audit.actor_id,
      actor_email: options.audit.actor_email ?? null,
      source: options.audit.source,
      result_count: items.length,
      sort,
      offset,
      project_key: options.project_key ?? null,
    });
  }

  return { items, sort, page };
}
