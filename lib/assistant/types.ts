import "server-only";

import type { AssistantMessageAttachment } from "@/types/assistant-attachments";

/**
 * Assistant 레이어에서 공용으로 쓰는 타입.
 * Route Handler → run-assistant → execute-tool 사이에서 흐른다.
 */

export type AssistantRunContext = {
  user_id: string;
  user_email?: string | null;
  /** 클라이언트가 보낸 세션 id. 아직 영속 sessions 테이블은 없고 로깅 용도로만 사용. */
  session_id?: string | null;
  /**
   * 현재 턴의 사용자 원문 메시지.
   * 쓰기 성격 도구(create_pending_action_for_memo)가 실행 전에 명시적 저장 의도를
   * 서버 측에서 재검증할 때 사용한다. 로깅/외부 응답에는 실리지 않는다.
   */
  user_message?: string;
};

export type AssistantAnswerKind =
  | "direct_answer"
  | "clarification_question"
  | "proposed_action"
  | "approval_required"
  | "blocked";

export type AssistantAnswer =
  | { kind: "direct_answer"; message: string }
  | { kind: "clarification_question"; message: string }
  | { kind: "proposed_action"; message: string; pending_action_ids: string[] }
  | { kind: "approval_required"; message: string; pending_action_ids: string[] }
  | { kind: "blocked"; message: string; reason: string };

export type ToolAccessTier = "read" | "proposal" | "restricted";

/** 도구 호출 단건의 구조화된 결과. */
export type ToolResult =
  | { kind: "data"; name: string; payload: unknown }
  | {
      kind: "pending_action";
      name: string;
      pending_action_id: string;
      sensitivity_flag: boolean;
    }
  | { kind: "blocked"; name: string; reason: string }
  | { kind: "error"; name: string; reason: string };

/** assistant 한 번의 실행에서 수집된 트레이스. 로그/디버그용. */
export type ToolCallTrace = {
  name: string;
  tier: ToolAccessTier;
  result_kind: ToolResult["kind"];
  /** 호출된 순번 (0부터). */
  step: number;
};

export type RunAssistantResult = {
  answer: AssistantAnswer;
  raw_text: string;
  tool_trace: ToolCallTrace[];
  pending_action_ids: string[];
  iterations: number;
  /** 클라이언트 인라인 카드용(원문·청크 미포함). */
  ui_attachments: AssistantMessageAttachment[];
};

export type RunAssistantFailure = {
  error: "openai_failed" | "iteration_limit" | "invalid_tool_arguments" | "internal";
  message: string;
};
