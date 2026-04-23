import "server-only";

import type { AssistantAnswer, ToolCallTrace } from "./types";

/**
 * 모델의 최종 텍스트와 tool trace 를 4+1 가지 응답 유형 중 하나로 매핑한다.
 *
 * 판단 우선순위:
 *   1. tool trace 에 `blocked` 가 있고 final text 가 그 사실을 전달하면 → blocked
 *   2. pending_action 이 만들어졌다면 → approval_required
 *   3. tool trace 에 proposal 관련 내용이 있고 pending 은 아닌 경우 → proposed_action (드물게만 발생)
 *   4. final text 가 질문부호로 끝나면 → clarification_question
 *   5. 그 외 → direct_answer
 *
 * 휴리스틱이 있으므로 최종적으로는 system prompt + 모델의 자연어 응답을 신뢰한다.
 * 이 매핑은 UI 디스패치 정도에만 쓰이고, 정책 집행 결과(memos 저장 여부 등)는
 * 이 매핑이 아니라 tool trace 자체로 결정된다.
 */
export function mapAssistantAnswer(params: {
  finalText: string;
  toolTrace: ToolCallTrace[];
  pendingActionIds: string[];
}): AssistantAnswer {
  const { finalText, toolTrace, pendingActionIds } = params;
  const text = finalText.trim();

  if (pendingActionIds.length > 0) {
    return {
      kind: "approval_required",
      message: text || "저장안을 만들었습니다. 승인하면 기록됩니다.",
      pending_action_ids: pendingActionIds,
    };
  }

  const hasBlocked = toolTrace.some((t) => t.result_kind === "blocked");
  if (hasBlocked) {
    const reason =
      toolTrace.find((t) => t.result_kind === "blocked")?.name ?? "unknown_tool";
    return {
      kind: "blocked",
      message: text || "요청을 처리할 수 없습니다.",
      reason,
    };
  }

  if (isQuestion(text)) {
    return { kind: "clarification_question", message: text };
  }

  if (looksLikeProposal(text)) {
    return {
      kind: "proposed_action",
      message: text,
      pending_action_ids: [],
    };
  }

  return { kind: "direct_answer", message: text };
}

function isQuestion(text: string): boolean {
  if (!text) return false;
  const last = text[text.length - 1];
  return last === "?" || last === "？";
}

const PROPOSAL_HINTS = [
  "진행할까요",
  "저장할까요",
  "기록할까요",
  "요약을 제안",
  "제안드립니다",
  "승인해주시면",
];

function looksLikeProposal(text: string): boolean {
  if (!text) return false;
  return PROPOSAL_HINTS.some((h) => text.includes(h));
}
