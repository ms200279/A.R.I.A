import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Memo } from "@/types/memo";

import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./types";

export type SearchMemosOptions = {
  query: string;
  limit?: number;
  project_key?: string | null;
};

export type SearchMemosResult = {
  items: Memo[];
  query: string;
};

/**
 * 제목/본문/project_key 기준 최소 검색.
 *
 * Supabase 의 `.or()` 는 comma-separated filter 를 받는다. 외부 입력을 안전하게
 * 넣기 위해 직접 이스케이프가 필요한 메타문자(`%`, `,`, `()`)는 모두 제거한다.
 * 전체 문서 검색 엔진이 필요해지면 이 모듈을 pg_trgm / tsvector 로 교체한다.
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
    .select(
      "id,user_id,title,content,summary,source_type,project_key,sensitivity_flag,status,created_at,updated_at",
    )
    .eq("status", "active")
    .or(
      [
        `title.ilike.%${safe}%`,
        `content.ilike.%${safe}%`,
        `project_key.ilike.%${safe}%`,
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.project_key) {
    builder = builder.eq("project_key", options.project_key);
  }

  const { data, error } = await builder;
  if (error || !data) {
    return { items: [], query: rawQuery };
  }
  return { items: data as Memo[], query: rawQuery };
}

function sanitizeForIlike(input: string): string {
  // ilike wildcard, PostgREST or() 구분자, 괄호를 제거한다.
  return input.replace(/[%,()]/g, "").trim();
}
