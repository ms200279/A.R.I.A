import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { rejectMemoAction } from "@/lib/memos";
import type { PendingActionStatus } from "@/types/pending-action";

import type { ApprovalActor, RejectResult } from "./types";

/**
 * action_type 에 무관한 상위 reject dispatcher.
 *
 * reject 는 사용자의 정상 의사표시이므로 "오류가 아니라" rejected 로 상태를 전이시킨다.
 * memos 테이블에는 어떤 쓰기도 일어나지 않는다.
 */
export async function rejectPendingAction(
  pendingActionId: string,
  actor: ApprovalActor,
): Promise<RejectResult> {
  const service = createServiceClient();

  const { data: pending, error } = await service
    .from("pending_actions")
    .select("id, user_id, action_type, status")
    .eq("id", pendingActionId)
    .eq("user_id", actor.user_id)
    .maybeSingle();

  if (error || !pending) return { status: "not_found" };

  const actionType = pending.action_type as string;
  const currentStatus = pending.status as PendingActionStatus;

  if (currentStatus !== "awaiting_approval") {
    return {
      status: "invalid_state",
      action_type: actionType,
      current_status: currentStatus,
    };
  }

  switch (actionType) {
    case "save_memo": {
      const result = await rejectMemoAction(pendingActionId, {
        user_id: actor.user_id,
        user_email: actor.user_email ?? null,
      });
      if (result.status === "rejected") {
        return { status: "rejected", action_type: actionType };
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
