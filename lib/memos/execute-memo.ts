import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  logMemoApprovalBlocked,
  logMemoApprovalConfirmIdempotent,
  logMemoApprovalExecuted,
} from "@/lib/logging/audit-log";
import { evaluateMemoCreate } from "@/lib/policies/memo";
import { detectSensitiveContent } from "@/lib/safety/sensitive";
import type { PendingActionStatus } from "@/types/pending-action";

import { parseSaveMemoPayload } from "./payload-schema";
import { isMemoSavedPendingResult } from "./pending-result-guards";
import type { ExecuteMemoResult } from "./types";

export type ExecuteMemoContext = {
  user_id: string;
  user_email?: string | null;
};

/**
 * awaiting_approval 상태의 save_memo pending_action 을 실제 memos insert 로 승격한다.
 *
 * 흐름:
 *   1) service_role 로 pending_action 재조회 (user_id 고정).
 *   2) payload Zod parse. 실패 시 `blocked` 전이.
 *   3) confirm 시점 정책: `evaluateMemoCreate(..., explicit: true)` + 민감도 재탐지.
 *   4) optimistic claim: awaiting_approval → approved (원자적 UPDATE).
 *      실패 시 이미 executed 면 멱등 성공(memo_id 반환), 그 외 상태는 invalid_state.
 *   5) memos insert. 실패 시 pending 을 approved → awaiting_approval 롤백.
 *   6) pending 을 approved → executed (WHERE status=approved) 로 확정. 실패 시 memo 삭제 후 롤백.
 *   7) 감사 로그.
 */
export async function executeApprovedMemo(
  pendingActionId: string,
  ctx: ExecuteMemoContext,
): Promise<ExecuteMemoResult> {
  const service = createServiceClient();

  const { data: pending, error: loadErr } = await service
    .from("pending_actions")
    .select(
      "id, user_id, action_type, target_type, status, payload, sensitivity_flag, result",
    )
    .eq("id", pendingActionId)
    .eq("user_id", ctx.user_id)
    .maybeSingle();

  if (loadErr || !pending) {
    return { status: "error", reason: "pending_action_not_found" };
  }
  if (pending.action_type !== "save_memo" || pending.target_type !== "memo") {
    return { status: "error", reason: "unsupported_action_type" };
  }

  const rowStatus = pending.status as string;
  if (rowStatus !== "awaiting_approval") {
    if (rowStatus === "executed" && isMemoSavedPendingResult(pending.result)) {
      await logMemoApprovalConfirmIdempotent({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        pending_action_id: pendingActionId,
        memo_id: pending.result.memo_id,
      });
      return { status: "executed", memo_id: pending.result.memo_id };
    }
    return {
      status: "invalid_state",
      current_status: rowStatus as PendingActionStatus,
    };
  }

  const parsed = parseSaveMemoPayload(pending.payload);
  if (!parsed.ok) {
    await markBlocked(service, pendingActionId, parsed.reason);
    await logMemoApprovalBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      pending_action_id: pendingActionId,
      reason: parsed.reason,
      metadata: { stage: "payload_validation" },
    });
    return { status: "blocked", reason: parsed.reason };
  }

  const payload = parsed.payload;
  const sensitivityMatches = detectSensitiveContent(payload.content);
  const evaluation = evaluateMemoCreate(
    {
      content: payload.content,
      title: payload.title,
      explicit: true,
    },
    sensitivityMatches,
  );

  if (evaluation.decision === "block") {
    await markBlocked(service, pendingActionId, evaluation.reason);
    await logMemoApprovalBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      pending_action_id: pendingActionId,
      reason: evaluation.reason,
      metadata: { stage: "confirm_policy", sensitivity_categories: sensitivityMatches },
    });
    return { status: "blocked", reason: evaluation.reason };
  }

  const sensitivityFlag =
    sensitivityMatches.length > 0 || pending.sensitivity_flag === true;

  const { data: claimed, error: claimErr } = await service
    .from("pending_actions")
    .update({ status: "approved" })
    .eq("id", pendingActionId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    const { data: again } = await service
      .from("pending_actions")
      .select("status, result")
      .eq("id", pendingActionId)
      .maybeSingle();

    const st = again?.status as string | undefined;
    if (st === "executed" && isMemoSavedPendingResult(again?.result)) {
      await logMemoApprovalConfirmIdempotent({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        pending_action_id: pendingActionId,
        memo_id: again.result.memo_id,
      });
      return { status: "executed", memo_id: again.result.memo_id };
    }
    if (st === "rejected" || st === "blocked") {
      return { status: "invalid_state", current_status: st as "rejected" | "blocked" };
    }
    return { status: "error", reason: "claim_failed" };
  }

  const { data: memo, error: insertErr } = await service
    .from("memos")
    .insert({
      user_id: ctx.user_id,
      title: payload.title,
      content: payload.content,
      source_type: payload.source_type,
      project_key: payload.project_key,
      sensitivity_flag: sensitivityFlag,
      status: "active",
    })
    .select("id")
    .single();

  if (insertErr || !memo) {
    await service
      .from("pending_actions")
      .update({ status: "awaiting_approval" })
      .eq("id", pendingActionId)
      .eq("status", "approved");
    return { status: "error", reason: "memo_insert_failed" };
  }

  const { data: finalized, error: finErr } = await service
    .from("pending_actions")
    .update({
      status: "executed",
      result: { kind: "memo_saved", memo_id: memo.id },
    })
    .eq("id", pendingActionId)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();

  if (finErr || !finalized) {
    await service.from("memos").delete().eq("id", memo.id).eq("user_id", ctx.user_id);
    await service
      .from("pending_actions")
      .update({ status: "awaiting_approval" })
      .eq("id", pendingActionId)
      .eq("status", "approved");
    return { status: "error", reason: "finalize_pending_failed" };
  }

  await logMemoApprovalExecuted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    pending_action_id: pendingActionId,
    memo_id: memo.id,
    sensitivity_flag: sensitivityFlag,
  });

  return { status: "executed", memo_id: memo.id };
}

async function markBlocked(
  service: ReturnType<typeof createServiceClient>,
  pendingActionId: string,
  reason: string,
): Promise<void> {
  await service
    .from("pending_actions")
    .update({
      status: "blocked",
      blocked_reason: reason,
      result: { kind: "blocked", reason },
    })
    .eq("id", pendingActionId)
    .eq("status", "awaiting_approval");
}
