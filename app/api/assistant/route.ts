import { NextResponse } from "next/server";

/**
 * POST /api/assistant
 * 사용자의 자연어 요청 진입점. 실제 처리는 `lib/orchestrator` 에서.
 *
 * 얇게 유지 원칙:
 * - 세션 확인 → 입력 검증(Zod) → `orchestrator.handle(...)` 호출만 하고 응답을 돌려준다.
 * - 외부 입력 본문은 `lib/safety` 전처리 경유. 이 파일에서 직접 LLM/DB 호출 금지.
 */
export async function POST() {
  // TODO: 세션 확인, 본문 스키마(Zod) 검증, orchestrator.handle 호출
  return NextResponse.json(
    { error: "not_implemented", message: "assistant route is not implemented yet" },
    { status: 501 },
  );
}
