import { NextResponse } from "next/server";

import { listDocuments } from "@/lib/documents/list-documents";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/documents
 *
 * Query: `limit`(기본 30, 상한 100), `cursor`(ISO, 정렬 컬럼 이전 페이지),
 * `sort` = `updated_at` | `created_at` (기본 `updated_at`).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sortRaw = url.searchParams.get("sort");
  const sort =
    sortRaw === "created_at" || sortRaw === "updated_at" ? sortRaw : undefined;
  if (sortRaw != null && sortRaw !== "" && sort === undefined) {
    return NextResponse.json(
      { error: "invalid_sort", allowed: ["created_at", "updated_at"] },
      { status: 400 },
    );
  }

  const result = await listDocuments(supabase, {
    scope_user_id: userData.user.id,
    limit: parseLimit(url.searchParams.get("limit")),
    cursor: url.searchParams.get("cursor"),
    sort,
    audit: {
      actor_id: userData.user.id,
      actor_email: userData.user.email ?? null,
      source: "api",
    },
  });

  return NextResponse.json({
    items: result.items,
    next_cursor: result.next_cursor,
    sort: result.sort,
  });
}
