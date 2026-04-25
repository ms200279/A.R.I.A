import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logMemoSearched } from "@/lib/logging/audit-log";
import type { MemoListItemPayload } from "@/types/memo";

import { MEMO_ROW_SELECT } from "./memo-columns";
import { mapMemosToListItems } from "./map-memo-dto";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./types";

export type SearchMemosOptions = {
  query: string;
  limit?: number;
  /**
   * `project_key` 열과 정확 일치(필터). UI `project_key` / legacy `tag` 쿼리.
   */
  project_key?: string | null;
  /**
   * legacy: `GET /api/memos/search?tag=` 가 이 필터로 올 때( project_key 와 동일 의미).
   */
  tag?: string | null;
  /**
   * `memos.tags` 배열에 이 문자열이 포함된 경우만(정확 일치 한 개).
   */
  memo_tag?: string | null;
  audit?: {
    actor_id: string;
    actor_email?: string | null;
    source: "api" | "rsc" | "assistant";
  };
};

export type SearchMemosResult = {
  items: MemoListItemPayload[];
  query: string;
};

/**
 * 제목/본문/summary/project_key 기반 최소 검색.
 *
 * Supabase `.or()` 는 comma-separated filter 를 받는다. 메타문자(`%`, `,`, `()`)는
 * 제거해 PostgREST 파서/와일드카드 남용을 막는다. 고급 전문 검색은 `tsvector` 등으로
 * 확장할 때 이 모듈을 대체한다.
 */
export async function searchMemos(options: SearchMemosOptions): Promise<SearchMemosResult> {
  const rawQuery = (options.query ?? "").trim();
  if (!rawQuery) return { items: [], query: "" };

  const safe = sanitizeForIlike(rawQuery);
  if (!safe) return { items: [], query: rawQuery };

  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

  const supabase = await createClient();

  const keyFilter = options.tag?.trim() || options.project_key?.trim() || null;
  const memoTag = (options.memo_tag ?? "").replace(/[%,()]/g, "").trim() || null;

  let builder = supabase
    .from("memos")
    .select(MEMO_ROW_SELECT)
    .eq("status", "active")
    .or(
      [
        `title.ilike.%${safe}%`,
        `content.ilike.%${safe}%`,
        `summary.ilike.%${safe}%`,
        `project_key.ilike.%${safe}%`,
      ].join(","),
    )
    .order("pinned", { ascending: false })
    .order("bookmarked", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (keyFilter) {
    builder = builder.eq("project_key", keyFilter);
  }
  if (memoTag) {
    builder = builder.contains("tags", [memoTag]);
  }

  const { data, error } = await builder;
  if (error) {
    if (options.audit) {
      await logMemoSearched({
        actor_id: options.audit.actor_id,
        actor_email: options.audit.actor_email ?? null,
        source: options.audit.source,
        result_count: 0,
        query_len: rawQuery.length,
        project_key: options.project_key ?? null,
        tag: options.tag ?? null,
      });
    }
    return { items: [], query: rawQuery };
  }

  const items = mapMemosToListItems(data ?? []);
  if (options.audit) {
    await logMemoSearched({
      actor_id: options.audit.actor_id,
      actor_email: options.audit.actor_email ?? null,
      source: options.audit.source,
      result_count: items.length,
      query_len: rawQuery.length,
      project_key: options.project_key ?? null,
      tag: options.tag ?? null,
    });
  }
  return { items, query: rawQuery };
}

function sanitizeForIlike(input: string): string {
  return input.replace(/[%,()]/g, "").trim();
}
