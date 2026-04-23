import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Memo } from "@/types/memo";

import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./types";

export type ListMemosOptions = {
  limit?: number;
  /** ISO 타임스탬프 (created_at). 이보다 과거의 행을 요구. */
  cursor?: string | null;
  project_key?: string | null;
};

export type ListMemosResult = {
  items: Memo[];
  next_cursor: string | null;
};

export async function listMemos(
  options: ListMemosOptions = {},
): Promise<ListMemosResult> {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT,
  );

  const supabase = await createClient();

  let query = supabase
    .from("memos")
    .select(
      "id,user_id,title,content,summary,source_type,project_key,sensitivity_flag,status,created_at,updated_at",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }
  if (options.project_key) {
    query = query.eq("project_key", options.project_key);
  }

  const { data, error } = await query;
  if (error || !data) {
    return { items: [], next_cursor: null };
  }

  const rows = data as Memo[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.length > 0 ? items[items.length - 1] : undefined;
  const next_cursor = hasMore && last ? last.created_at : null;
  return { items, next_cursor };
}
