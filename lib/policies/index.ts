/**
 * lib/policies
 *
 * 액션 등급 판정 및 승인 필요 여부 결정.
 * 등급 정의는 docs/action-policy.md 와 1:1 로 동기화된다.
 *
 * 공개 API (초안):
 *   classify(action) -> ActionTier
 *   evaluate(action, context) -> EvaluateResult
 */

import type { ActionTier, AppAction, EvaluateResult } from "@/types/action";

export function classify(_action: AppAction): ActionTier {
  // TODO: action.kind 에 따라 Read | Suggest | CreateLowRisk | CreateApproval | Sensitive 매핑
  throw new Error("not_implemented: lib/policies.classify");
}

export function evaluate(_action: AppAction, _context: { userId: string }): EvaluateResult {
  // TODO:
  //  1) classify 로 등급 판정
  //  2) Sensitive 는 기본 차단
  //  3) CreateApproval 은 requireApproval=true 로 반환
  //  4) 차단 시 lib/logging 에 policy_violation 기록 (side-effect)
  throw new Error("not_implemented: lib/policies.evaluate");
}

export {
  evaluateMemoCreate,
  MEMO_CONTENT_MAX,
  type MemoBlockReason,
  type MemoCreateEvaluation,
  type MemoCreateIntent,
} from "./memo";

export {
  evaluateSummarizerContentPolicy,
  type SummarizeContentPolicyResult,
} from "./summarize-content";

export { DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS } from "./document-summary";

export {
  DOCUMENT_UPLOAD_MAX_BYTES,
  validateDocumentUpload,
  type UploadValidationResult,
} from "./document-upload";

export {
  evaluateAssistantPreGate,
  evaluateSaveMemoIntent,
  type AssistantPolicyBlockReason,
  type AssistantPreGateResult,
  type SaveMemoIntentEvaluation,
} from "./assistant";
