import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { listMemos, type MemoSortField } from "@/lib/memos";
import type { MemoListApiResponse } from "@/types/memos";

export const dynamic = "force-dynamic";

const SORTS: MemoSortField[] = ["created_at", "updated_at"];

function parseSort(v: string | null): MemoSortField | undefined {
  if (v === "created_at" || v === "updated_at") return v;
  return undefined;
}

/**
 * GET /api/memos
 *   본인 메모 목록. RLS 로 강제됨.
 *   query:
 *     limit?  number  (default 50, max 200)
 *     offset? number  (0 기반; 핀·북마크 다음 정렬)
 *     project_key? string
 *     sort?  created_at | updated_at  (기본 updated_at)
 *
 * POST 는 /api/memos/create 로 분리. (명시 저장)
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const projectKey = url.searchParams.get("project_key");
  const sortParam = url.searchParams.get("sort");
  const sort = parseSort(sortParam);
  const offsetParsed = offsetParam ? Number.parseInt(offsetParam, 10) : 0;
  const offset = Number.isFinite(offsetParsed) && offsetParsed >= 0 ? offsetParsed : 0;

  if (sortParam && !sort) {
    return NextResponse.json(
      { error: "invalid_query", field: "sort", allowed: SORTS },
      { status: 400 },
    );
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const result = await listMemos({
    limit: Number.isFinite(limit) ? limit : undefined,
    offset,
    project_key: projectKey ?? null,
    sort,
    audit: {
      actor_id: userData.user.id,
      actor_email: userData.user.email ?? null,
      source: "api",
    },
  });

  const body: MemoListApiResponse = {
    items: result.items,
    sort: result.sort,
    page: result.page,
  };
  return NextResponse.json(body);
}
