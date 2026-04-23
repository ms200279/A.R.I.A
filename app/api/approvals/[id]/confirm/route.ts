import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { confirmPendingAction } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/confirm
 *
 * 단일 실행 채널. Route Handler 는 얇게 유지한다:
 *   1) 인증 세션 확인
 *   2) `confirmPendingAction(id, actor)` 로 위임
 *   3) 반환 status 를 HTTP 응답으로 매핑
 *
 * HTTP 상태 코드 매핑:
 *   - executed                → 200
 *   - blocked                 → 200  (정책 판정 결과는 오류가 아님, body 로 표현)
 *   - not_found               → 404
 *   - invalid_state           → 409
 *   - unsupported_action_type → 400
 *   - error                   → 500
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await confirmPendingAction(id, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  });

  switch (result.status) {
    case "executed":
      return NextResponse.json(result, { status: 200 });
    case "blocked":
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
        {
          error: result.reason,
          action_type: result.action_type,
        },
        { status: 500 },
      );
  }
}
