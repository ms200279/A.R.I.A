import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { searchMemos } from "@/lib/memos";

export const dynamic = "force-dynamic";

/**
 * GET /api/memos/search?q=...&limit=...&project_key=...&tag=...
 * `tag` / `project_key` 는 `project_key` 열에 대한 정확 일치 필터(동시 지정 시 `tag` 우선).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limitParam = url.searchParams.get("limit");
  const projectKey = url.searchParams.get("project_key");
  const tag = url.searchParams.get("tag");

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const result = await searchMemos({
    query: q,
    limit: Number.isFinite(limit) ? limit : undefined,
    project_key: projectKey ?? null,
    tag: tag ?? null,
    audit: {
      actor_id: userData.user.id,
      actor_email: userData.user.email ?? null,
      source: "api",
    },
  });
  return NextResponse.json(result);
}
