import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { rejectPendingAction } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/reject
 *
 * 사용자의 거절 의사. memos 는 쓰이지 않고 pending_action 만 rejected 로 전이.
 * reject 는 오류가 아닌 정상 상태 전이이므로 HTTP 200 으로 반환한다.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await rejectPendingAction(id, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  });

  switch (result.status) {
    case "rejected":
      return NextResponse.json(result, { status: 200 });
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "invalid_state":
      return NextResponse.json(
        {
          error: "invalid_status",
          action_type: result.action_type,
          current_status: result.current_status,
        },
        { status: 409 },
      );
    case "unsupported_action_type":
      return NextResponse.json(
        { error: "unsupported_action_type", action_type: result.action_type },
        { status: 400 },
      );
    case "error":
      return NextResponse.json(
        { error: result.reason, action_type: result.action_type },
        { status: 500 },
      );
  }
}
