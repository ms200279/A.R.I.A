import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logMemoSearched } from "@/lib/logging/audit-log";
import type { Memo } from "@/types/memo";

import { MEMO_ROW_SELECT } from "./memo-columns";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./types";

export type SearchMemosOptions = {
  query: string;
  limit?: number;
  /**
   * `project_key` 열과 정확 일치(필터). UI/API 에서 "프로젝트" 를 좁힐 때.
   */
  project_key?: string | null;
  /**
   * 스키마에 별도 `tag` 열이 없다. `project_key` 를 태그 용도로 쓰는 흐름과
   * 동일하게 **정확 일치**로 필터한다. `q` 본문 검색과 AND 로 결합.
   */
  tag?: string | null;
  audit?: {
    actor_id: string;
    actor_email?: string | null;
    source: "api" | "rsc" | "assistant";
  };
};

export type SearchMemosResult = {
  items: Memo[];
  query: string;
};

/**
 * 제목/본문/summary/project_key 기반 최소 검색.
 *
 * Supabase `.or()` 는 comma-separated filter 를 받는다. 메타문자(`%`, `,`, `()`)는
 * 제거해 PostgREST 파서/와일드카드 남용을 막는다. 고급 전문 검색은 `tsvector` 등으로
 * 확장할 때 이 모듈을 대체한다.
 */
export async function searchMemos(
  options: SearchMemosOptions,
): Promise<SearchMemosResult> {
  const rawQuery = (options.query ?? "").trim();
  if (!rawQuery) return { items: [], query: "" };

  const safe = sanitizeForIlike(rawQuery);
  if (!safe) return { items: [], query: rawQuery };

  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT,
  );

  const supabase = await createClient();

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
    .order("updated_at", { ascending: false })
    .limit(limit);

  const keyFilter = options.tag?.trim() || options.project_key?.trim() || null;
  if (keyFilter) {
    builder = builder.eq("project_key", keyFilter);
  }

  const { data, error } = await builder;
  if (error || !data) {
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

  const items = data as Memo[];
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
