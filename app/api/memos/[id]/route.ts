import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getMemo } from "@/lib/memos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/memos/[id]
 * 단일 메모 조회. RLS 로 본인 행만 허용.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const memo = await getMemo(id);
  if (!memo) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ memo });
}
