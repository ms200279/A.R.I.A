/**
 * 메모 저장 요청에 대한 정책 판정.
 *
 * 핵심 규칙:
 *   - 사용자의 명시 저장 의도가 없으면 무조건 block.
 *   - 본문이 비어 있거나 과도하게 길면 block (DB 제약과 일치).
 *   - 민감정보는 여기서는 block 으로 변환하지 않는다.
 *     대신 pending_action.sensitivity_flag 로 이어지도록 호출부에 넘긴다.
 *     (UI 에서 stronger confirm 이 가능하도록 구조만 유지)
 *
 * 이 모듈은 순수 함수만 제공한다. DB 접근/외부 IO 금지.
 */

import type { SensitivityMatch } from "../safety/sensitive";

export const MEMO_CONTENT_MAX = 50_000;

export type MemoCreateIntent = {
  content: string;
  title: string | null;
  explicit: boolean;
};

export type MemoBlockReason =
  | "missing_explicit_intent"
  | "empty_content"
  | "too_long";

export type MemoCreateEvaluation =
  | {
      decision: "allow";
      requires_approval: true;
      sensitivity: SensitivityMatch[];
    }
  | {
      decision: "block";
      reason: MemoBlockReason;
      sensitivity: SensitivityMatch[];
    };

export function evaluateMemoCreate(
  intent: MemoCreateIntent,
  sensitivity: SensitivityMatch[] = [],
): MemoCreateEvaluation {
  const content = (intent.content ?? "").trim();
  if (!content) {
    return { decision: "block", reason: "empty_content", sensitivity };
  }
  if (content.length > MEMO_CONTENT_MAX) {
    return { decision: "block", reason: "too_long", sensitivity };
  }
  if (!intent.explicit) {
    return { decision: "block", reason: "missing_explicit_intent", sensitivity };
  }
  return { decision: "allow", requires_approval: true, sensitivity };
}
