import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { searchMemos } from "@/lib/memos";

export const dynamic = "force-dynamic";

/**
 * GET /api/memos/search?q=...&limit=...&project_key=...
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

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const result = await searchMemos({
    query: q,
    limit: Number.isFinite(limit) ? limit : undefined,
    project_key: projectKey ?? null,
  });
  return NextResponse.json(result);
}
