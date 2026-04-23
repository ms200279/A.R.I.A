import "server-only";

/**
 * lib/orchestrator
 *
 * 사용자의 자연어 요청을 받아 어떤 도메인 모듈을 호출할지 결정하고 결과를 합성한다.
 *
 * 제약:
 *  - 직접 I/O 하지 않는다. 모든 DB/외부 API 접근은 도메인 모듈 또는 `lib/integrations` 에 맡긴다.
 *  - 실행 계열 액션은 직접 실행하지 않고 `pending_actions` 를 만들어 승인 플로우로 돌린다.
 *  - 외부 입력은 `lib/safety.prepareUntrusted` 통과 후만 LLM 에 전달.
 */

export type AssistantRequest = {
  userId: string;
  message: string;
  /** 현재 세션 id (장기 메모와 절대 섞이지 않는다) */
  sessionId: string;
};

export type AssistantResponse =
  | { kind: "text"; text: string }
  | { kind: "proposal"; pendingActionId: string; summary: string };

export async function handle(_request: AssistantRequest): Promise<AssistantResponse> {
  // TODO:
  //  1) 세션/소유자 검증 (server client)
  //  2) 인텐트 분류 (LLM 또는 규칙)
  //  3) 도메인 모듈 호출 (documents/mail/calendar/memos)
  //  4) 쓰기 필요 시 pending_actions 생성 후 { kind: "proposal" } 반환
  //  5) 그 외엔 { kind: "text" } 로 반환
  throw new Error("not_implemented: lib/orchestrator.handle");
}
