import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/reject
 * 승인 대기 액션을 사용자가 거절한다. 외부 시스템 호출은 일어나지 않는다.
 *
 * 필수 흐름 (구현 시):
 *  1) 세션 확인, 소유자 검증
 *  2) `pending_actions.status = rejected`
 *  3) `lib/logging` 으로 감사 로그 (action=reject)
 */
export async function POST(_request: Request, { params }: Params) {
  const { id: _id } = await params;
  // TODO: 위 1~3 단계 구현
  return NextResponse.json(
    { error: "not_implemented", message: "approval reject is not implemented yet" },
    { status: 501 },
  );
}
