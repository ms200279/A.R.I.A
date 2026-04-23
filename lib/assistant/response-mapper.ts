import "server-only";

import type { AssistantAnswer, ToolCallTrace } from "./types";

/**
 * 모델의 최종 텍스트와 tool trace 를 4+1 가지 응답 유형 중 하나로 매핑한다.
 *
 * 판단 우선순위:
 *   1. pending_action 이 만들어졌다면 → approval_required
 *   2. propose_save_memo 만 호출되고 pending 은 없다면 → proposed_action (Stage 1)
 *   3. tool trace 에 `blocked` 가 있으면 → blocked
 *   4. final text 가 질문부호로 끝나거나 저장 의도 재확인 형태면 → clarification_question
 *   5. 텍스트 휴리스틱(저장할까요 등) 매치 시 → proposed_action
 *   6. 그 외 → direct_answer
 *
 * tool trace 가 response kind 의 주요 근거이고, 텍스트 휴리스틱은 fallback 이다.
 * 정책 집행(memos 실제 저장 여부 등)은 이 매핑이 아니라 tool trace 자체로 결정된다.
 */
export function mapAssistantAnswer(params: {
  finalText: string;
  toolTrace: ToolCallTrace[];
  pendingActionIds: string[];
}): AssistantAnswer {
  const { finalText, toolTrace, pendingActionIds } = params;
  const text = finalText.trim();

  // 1) 실제로 pending_action 이 만들어졌다 → 무조건 approval_required.
  if (pendingActionIds.length > 0) {
    return {
      kind: "approval_required",
      message:
        text ||
        "저장안을 만들었습니다. 메모 목록의 승인 화면에서 최종 저장을 진행해 주세요.",
      pending_action_ids: pendingActionIds,
    };
  }

  // 2) propose_save_memo (preview) 가 호출되었지만 아직 pending 은 없다 → proposed_action.
  //    "이 내용으로 저장할까요?" 단계. 사용자의 다음 턴 동의 뒤에만 Stage 2 로 간다.
  const calledProposalPreview = toolTrace.some(
    (t) => t.name === "propose_save_memo" && t.result_kind === "data",
  );
  if (calledProposalPreview) {
    return {
      kind: "proposed_action",
      message:
        text || "이 내용으로 저장안을 만들 수 있습니다. 저장을 진행할까요?",
      pending_action_ids: [],
    };
  }

  // 3) 도구 실행에서 blocked 가 나왔다 → blocked.
  const hasBlocked = toolTrace.some((t) => t.result_kind === "blocked");
  if (hasBlocked) {
    const blockedTool = toolTrace.find((t) => t.result_kind === "blocked");
    const reason = blockedTool?.name ?? "unknown_tool";
    return {
      kind: "blocked",
      message:
        text ||
        (blockedTool?.name === "create_pending_action_for_memo"
          ? "저장 의도가 명확하지 않아 저장안을 만들지 않았습니다. 정확히 무엇을 저장할지 다시 알려주세요."
          : "요청을 처리할 수 없습니다."),
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
