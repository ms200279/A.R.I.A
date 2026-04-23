import { NextResponse } from "next/server";

/**
 * GET /api/approvals
 * 현재 사용자의 승인 대기(`pending_actions`) 목록을 돌려준다.
 *
 * 얇게 유지 원칙:
 * - 세션 확인 → RLS 적용된 server client 로 조회 → 반환.
 * - 실행은 `[id]/confirm` 에서만 일어난다. 여기서는 조회 전용.
 */
export async function GET() {
  // TODO: 세션 확인, pending_actions 목록 조회 (RLS)
  return NextResponse.json(
    { error: "not_implemented", message: "approvals list is not implemented yet" },
    { status: 501 },
  );
}
