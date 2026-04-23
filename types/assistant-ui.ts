/**
 * Assistant 대시보드 UI 전용 타입.
 *
 * 서버 `AssistantAnswer` (lib/assistant/types.ts) 와 1:1 로 일치하지 않는 이유:
 *  - 채팅 메시지 레벨에는 user 가 보낸 말풍선도 있다 (answer 아님).
 *  - network/정상 흐름 외에 "fetch 실패" 같은 프론트엔드 전용 상태도 표현해야 한다.
 *  - 서버 answer 의 형태가 늘어나도(예: tool_card 추가) 프론트엔드에서 graceful 하게
 *    normalize 하기 위해 얇은 중간 타입을 둔다.
 *
 * 서버 응답 형태는 `fetch("/api/assistant/query")` 의 JSON 을 그대로 쓰지 않고,
 * 훅에서 정규화한 뒤 이 타입으로 변환해 컴포넌트에 내려준다.
 */

/** 구(sphere) 가 표현해야 하는 assistant 상태 머신. */
export type AssistantVisualState =
  | "idle"
  | "focused"
  | "thinking"
  | "responding"
  | "error";

/** 서버에서 내려오는 answer.kind. 프론트엔드는 이 값을 신뢰해 렌더링만 분기한다. */
export type AssistantAnswerKind =
  | "direct_answer"
  | "clarification_question"
  | "proposed_action"
  | "approval_required"
  | "blocked";

/** 사용자가 보낸 말풍선. */
export type UserChatMessage = {
  id: string;
  role: "user";
  content: string;
  createdAt: number;
};

/** assistant 가 보낸 말풍선. answer.kind 별로 렌더링이 달라진다. */
export type AssistantChatMessage = {
  id: string;
  role: "assistant";
  kind: AssistantAnswerKind;
  content: string;
  createdAt: number;
  /** approval_required / proposed_action 에서 사용. 추후 카드 렌더링에 활용. */
  pendingActionIds?: string[];
  /** blocked 일 때의 사유 코드. */
  reason?: string;
  /** 사용한 provider (디버깅/표시용). */
  provider?: string;
};

/** 프론트엔드 네트워크 에러 등을 사용자에게 보여줄 때 쓰는 system 말풍선. */
export type SystemChatMessage = {
  id: string;
  role: "system";
  content: string;
  createdAt: number;
  tone: "neutral" | "error";
};

export type ChatMessage =
  | UserChatMessage
  | AssistantChatMessage
  | SystemChatMessage;
