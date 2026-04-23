import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { executeApprovedMemo } from "@/lib/memos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/confirm
 * 유일한 실행 채널.
 *   1) 세션/소유자 확인
 *   2) pending_action.action_type 에 따라 dispatch (현재는 save_memo 만 구현)
 *   3) 도메인 모듈에서 실제 쓰기 + 상태 전이 + 감사 로그 처리
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: pending, error: pendingErr } = await supabase
    .from("pending_actions")
    .select("id, action_type, status")
    .eq("id", id)
    .maybeSingle();

  if (pendingErr || !pending) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (pending.status !== "awaiting_approval") {
    return NextResponse.json(
      { error: "invalid_status", status: pending.status },
      { status: 409 },
    );
  }

  switch (pending.action_type) {
    case "save_memo": {
      const result = await executeApprovedMemo(id, {
        user_id: userData.user.id,
        user_email: userData.user.email ?? null,
      });
      if (result.status === "error") {
        return NextResponse.json({ error: result.reason }, { status: 500 });
      }
      return NextResponse.json(result, { status: 200 });
    }
    default:
      return NextResponse.json(
        { error: "unsupported_action_type", action_type: pending.action_type },
        { status: 400 },
      );
  }
}
