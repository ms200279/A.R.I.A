import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { logMemoApprovalExecuted } from "@/lib/logging/audit-log";
import type { SaveMemoPayload } from "@/types/pending-action";

import type { ExecuteMemoResult } from "./types";

export type ExecuteMemoContext = {
  user_id: string;
  user_email?: string | null;
};

/**
 * awaiting_approval 상태의 pending_action 을 실제 memos insert 로 승격한다.
 *
 * - pending_action 소유자 검증은 호출 전 Route Handler 에서 이미 수행되어 있어야 한다.
 * - 동일 pending_action 의 동시 confirm 을 방지하기 위해 status 컬럼 조건 update 로
 *   낙관적 락 유사 동작을 취한다. (PostgreSQL 의 update with where 는 즉시 원자적)
 * - memo insert 가 실패하면 pending_action 은 awaiting_approval 로 되돌린다.
 */
export async function executeApprovedMemo(
  pendingActionId: string,
  ctx: ExecuteMemoContext,
): Promise<ExecuteMemoResult> {
  const service = createServiceClient();

  const { data: pending, error: loadErr } = await service
    .from("pending_actions")
    .select("id, user_id, action_type, target_type, status, payload, sensitivity_flag")
    .eq("id", pendingActionId)
    .eq("user_id", ctx.user_id)
    .maybeSingle();

  if (loadErr || !pending) {
    return { status: "error", reason: "pending_action_not_found" };
  }
  if (pending.action_type !== "save_memo" || pending.target_type !== "memo") {
    return { status: "error", reason: "unsupported_action_type" };
  }
  if (pending.status !== "awaiting_approval") {
    return { status: "error", reason: `invalid_status:${pending.status}` };
  }

  const { data: claimed, error: claimErr } = await service
    .from("pending_actions")
    .update({ status: "approved" })
    .eq("id", pendingActionId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    return { status: "error", reason: "claim_failed" };
  }

  const payload = pending.payload as SaveMemoPayload;

  const { data: memo, error: insertErr } = await service
    .from("memos")
    .insert({
      user_id: ctx.user_id,
      title: payload.title,
      content: payload.content,
      source_type: payload.source_type ?? "quick_capture",
      project_key: payload.project_key,
      sensitivity_flag: pending.sensitivity_flag,
    })
    .select("id")
    .single();

  if (insertErr || !memo) {
    // rollback best-effort: 승인 상태 되돌림 (이미 approved 인 경우만)
    await service
      .from("pending_actions")
      .update({ status: "awaiting_approval" })
      .eq("id", pendingActionId)
      .eq("status", "approved");
    return { status: "error", reason: "memo_insert_failed" };
  }

  await service
    .from("pending_actions")
    .update({
      status: "executed",
      result: { kind: "memo_saved", memo_id: memo.id },
    })
    .eq("id", pendingActionId);

  await logMemoApprovalExecuted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    pending_action_id: pendingActionId,
    memo_id: memo.id,
    sensitivity_flag: pending.sensitivity_flag,
  });

  return { status: "executed", memo_id: memo.id };
}
