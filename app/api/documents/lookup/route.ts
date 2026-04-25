import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const HEX64 = /^[a-f0-9]{64}$/i;

/**
 * GET /api/documents/lookup?sha256=
 *
 * 현재 사용자 문서 중 동일 sha256_hash 최신 1건(있으면). 중복 업로드 안내용.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("sha256")?.trim().toLowerCase() ?? "";
  if (!HEX64.test(raw)) {
    return NextResponse.json({ error: "invalid_sha256" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id,title,file_name,updated_at")
    .eq("user_id", userData.user.id)
    .eq("sha256_hash", raw)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
