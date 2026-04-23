import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  logMemoApprovalRejectIdempotent,
  logMemoApprovalRejected,
} from "@/lib/logging/audit-log";
import type { PendingActionStatus } from "@/types/pending-action";

import type { RejectMemoResult } from "./types";

export type RejectMemoContext = {
  user_id: string;
  user_email?: string | null;
};

export async function rejectMemoAction(
  pendingActionId: string,
  ctx: RejectMemoContext,
): Promise<RejectMemoResult> {
  const service = createServiceClient();

  const { data: pending, error: loadErr } = await service
    .from("pending_actions")
    .select("id, user_id, action_type, status")
    .eq("id", pendingActionId)
    .eq("user_id", ctx.user_id)
    .maybeSingle();

  if (loadErr || !pending) {
    return { status: "error", reason: "pending_action_not_found" };
  }
  if (pending.action_type !== "save_memo") {
    return { status: "error", reason: "unsupported_action_type" };
  }

  if (pending.status === "rejected") {
    await logMemoApprovalRejectIdempotent({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      pending_action_id: pendingActionId,
    });
    return { status: "rejected" };
  }

  if (pending.status !== "awaiting_approval") {
    return {
      status: "invalid_state",
      current_status: pending.status as PendingActionStatus,
    };
  }

  const { data: updated, error: updErr } = await service
    .from("pending_actions")
    .update({
      status: "rejected",
      result: { kind: "rejected" },
    })
    .eq("id", pendingActionId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();

  if (updErr || !updated) {
    const { data: again } = await service
      .from("pending_actions")
      .select("status")
      .eq("id", pendingActionId)
      .maybeSingle();
    if (again?.status === "rejected") {
      await logMemoApprovalRejectIdempotent({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        pending_action_id: pendingActionId,
      });
      return { status: "rejected" };
    }
    return { status: "error", reason: "reject_failed" };
  }

  await logMemoApprovalRejected({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    pending_action_id: pendingActionId,
  });

  return { status: "rejected" };
}
