import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { logMemoApprovalConfirmIdempotent } from "@/lib/logging/audit-log";
import { executeApprovedMemo } from "@/lib/memos";
import { isMemoSavedPendingResult } from "@/lib/memos/pending-result-guards";
import type { PendingActionStatus } from "@/types/pending-action";

import type { ApprovalActor, ConfirmResult } from "./types";

/**
 * action_type 에 무관한 상위 confirm dispatcher.
 *
 * Route Handler 는 이 함수 하나만 호출하면 된다. 소유자/상태 공통 검증은 여기서 수행하고,
 * 실제 실행은 action_type 별 도메인 서비스(executeApprovedMemo 등) 로 위임한다.
 *
 * 소유자 검증은 service_role 로 이루어진다. (Route Handler 의 RLS 조회만으로는
 * 나중 상태 전이 사이에 RLS 가 풀린 것처럼 보일 수 있으므로 defense-in-depth.)
 */
export async function confirmPendingAction(
  pendingActionId: string,
  actor: ApprovalActor,
): Promise<ConfirmResult> {
  const service = createServiceClient();

  const { data: pending, error } = await service
    .from("pending_actions")
    .select("id, user_id, action_type, status, result")
    .eq("id", pendingActionId)
    .eq("user_id", actor.user_id)
    .maybeSingle();

  if (error || !pending) return { status: "not_found" };

  const actionType = pending.action_type as string;
  const currentStatus = pending.status as PendingActionStatus;

  if (currentStatus !== "awaiting_approval") {
    if (
      actionType === "save_memo" &&
      currentStatus === "executed" &&
      isMemoSavedPendingResult(pending.result)
    ) {
      await logMemoApprovalConfirmIdempotent({
        actor_id: actor.user_id,
        actor_email: actor.user_email ?? null,
        pending_action_id: pendingActionId,
        memo_id: pending.result.memo_id,
      });
      return {
        status: "executed",
        action_type: actionType,
        memo_id: pending.result.memo_id,
      };
    }
    return {
      status: "invalid_state",
      action_type: actionType,
      current_status: currentStatus,
    };
  }

  switch (actionType) {
    case "save_memo": {
      const result = await executeApprovedMemo(pendingActionId, {
        user_id: actor.user_id,
        user_email: actor.user_email ?? null,
      });
      if (result.status === "executed") {
        return {
          status: "executed",
          action_type: actionType,
          memo_id: result.memo_id,
        };
      }
      if (result.status === "blocked") {
        return {
          status: "blocked",
          action_type: actionType,
          reason: result.reason,
        };
      }
      if (result.status === "invalid_state") {
        return {
          status: "invalid_state",
          action_type: actionType,
          current_status: result.current_status,
        };
      }
      return {
        status: "error",
        action_type: actionType,
        reason: result.reason,
      };
    }
    default:
      return { status: "unsupported_action_type", action_type: actionType };
  }
}
