import { NextResponse } from "next/server";

/**
 * GET  /api/memos   — 사용자 메모 목록
 * POST /api/memos   — 메모 **명시 저장** (자동 장기 기억 금지)
 *
 * 얇게 유지 원칙:
 * - 세션 확인, Zod 검증, `lib/memos` 위임.
 * - 정책상 삭제 엔드포인트는 만들지 않는다 (docs/action-policy.md 참조).
 */
export async function GET() {
  // TODO: 세션 확인, memos 목록 조회 (RLS)
  return NextResponse.json(
    { error: "not_implemented", message: "memos list is not implemented yet" },
    { status: 501 },
  );
}

export async function POST() {
  // TODO: 세션 확인, 본문 검증(Zod), lib/memos.create 위임
  return NextResponse.json(
    { error: "not_implemented", message: "memos create is not implemented yet" },
    { status: 501 },
  );
}
