import "server-only";

import type { PendingActionStatus } from "@/types/pending-action";

export type ApprovalActor = {
  user_id: string;
  user_email?: string | null;
};

/**
 * confirm dispatcher 의 표준 반환.
 *
 * - `executed`  : write 가 실제로 반영된 최종 성공 상태.
 * - `blocked`   : 정책/payload 검증으로 이번 pending_action 은 재시도 불가.
 * - `error`     : 일시적 오류 (DB/claim 실패 등). 이론적으로 재시도 가능.
 * - `not_found` : 소유자 검증 실패 또는 존재하지 않음.
 * - `invalid_state` : awaiting_approval 이 아닌 상태(이미 executed/rejected/blocked 등).
 * - `unsupported_action_type` : 현재 버전이 모르는 action_type.
 */
export type ConfirmResult =
  | { status: "executed"; action_type: string; memo_id?: string }
  | { status: "blocked"; action_type: string; reason: string }
  | { status: "error"; action_type: string; reason: string }
  | { status: "not_found" }
  | {
      status: "invalid_state";
      action_type: string;
      current_status: PendingActionStatus;
    }
  | { status: "unsupported_action_type"; action_type: string };

export type RejectResult =
  | { status: "rejected"; action_type: string }
  | { status: "error"; action_type: string; reason: string }
  | { status: "not_found" }
  | {
      status: "invalid_state";
      action_type: string;
      current_status: PendingActionStatus;
    }
  | { status: "unsupported_action_type"; action_type: string };
