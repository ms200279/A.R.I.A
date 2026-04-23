import "server-only";

/**
 * lib/orchestrator
 *
 * 사용자의 자연어 요청을 받아 어떤 도메인 모듈을 호출할지 결정하고 결과를 합성한다.
 *
 * 현재 단계에서는 오케스트레이션을 provider-agnostic assistant 루프(`lib/assistant`)가
 * 전담한다 (기본 provider 는 Gemini, 대체 provider 로 OpenAI Responses API).
 * 이 파일은 향후 레거시 인텐트 분류/룰 기반 라우팅 계층이 추가될 때 상위 진입점이
 * 되도록 얇게 유지된다.
 *
 * 정책 요약:
 *  - 직접 I/O 하지 않는다. 실제 DB/외부 API 접근은 도메인 모듈 또는 assistant tool 경유.
 *  - 실행 계열 액션은 직접 실행하지 않고 pending_actions 를 만들어 승인 플로우로 돌린다.
 *  - 외부 입력은 `lib/safety.prepareUntrusted` 통과 후만 LLM 에 전달.
 */

export {
  runAssistant,
  type RunAssistantInput,
  type RunAssistantOutput,
} from "@/lib/assistant";

/**
 * Legacy API shape — 초안 단계에서 정의했던 단순 응답 타입.
 * 호환을 위해 남겨두되, 새 코드는 `RunAssistantOutput.data.answer` 를 직접 쓴다.
 */
export type AssistantRequest = {
  userId: string;
  message: string;
  sessionId: string;
};

export type AssistantResponse =
  | { kind: "text"; text: string }
  | { kind: "proposal"; pendingActionId: string; summary: string };
