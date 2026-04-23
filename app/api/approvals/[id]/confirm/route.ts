import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/confirm
 * 승인 대기 액션을 실제 실행으로 넘기는 **유일한 채널**.
 *
 * 필수 흐름 (구현 시):
 *  1) 세션 확인
 *  2) `pending_actions` 에서 해당 레코드 로드 (소유자 확인)
 *  3) `lib/policies.evaluate()` 재검증 — 승인 시점과 실행 시점 사이에 정책 변경이 있었을 수 있음
 *  4) 도메인 모듈 실행 (예: calendar.createFromApproval)
 *  5) 결과를 `execution_log` 에 기록, `pending_actions.status` 를 마감
 *  6) `lib/logging` 으로 감사 로그 기록
 */
export async function POST(_request: Request, { params }: Params) {
  const { id: _id } = await params;
  // TODO: 위 1~6 단계 구현
  return NextResponse.json(
    { error: "not_implemented", message: "approval confirm is not implemented yet" },
    { status: 501 },
  );
}
