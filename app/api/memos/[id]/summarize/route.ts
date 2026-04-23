import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { summarizeMemo } from "@/lib/memos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/memos/[id]/summarize
 * 규칙 기반 요약 생성 (LLM 공급자 미결정 단계의 임시 구현).
 * 승인 불필요. 본인 메모에만 동작.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await summarizeMemo(id, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  });

  if (result.status === "error") {
    const status = result.reason === "forbidden" ? 403 : result.reason === "memo_not_found" ? 404 : 500;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ memo: result.memo });
}
