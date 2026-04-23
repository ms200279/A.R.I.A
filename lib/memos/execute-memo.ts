import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  logMemoApprovalBlocked,
  logMemoApprovalExecuted,
} from "@/lib/logging/audit-log";
import { detectSensitiveContent } from "@/lib/safety/sensitive";

import { parseSaveMemoPayload } from "./payload-schema";
import type { ExecuteMemoResult } from "./types";

export type ExecuteMemoContext = {
  user_id: string;
  user_email?: string | null;
};

/**
 * awaiting_approval 상태의 save_memo pending_action 을 실제 memos insert 로 승격한다.
 *
 * 흐름:
 *   1) service_role 로 pending_action 재조회 (user_id 고정) — route handler 의 RLS 조회
 *      와 별개로 한 번 더 소유자/타입/상태를 엄격히 검증한다.
 *   2) payload 를 Zod 로 parse. 실패 시 pending_action 을 `blocked` 로 전이하고
 *      감사 로그를 남긴 뒤 status="blocked" 로 반환 (memos 는 절대 쓰지 않음).
 *   3) safety 규칙으로 sensitivity_flag 를 confirm 시점 기준으로 재산출.
 *      (pending_action 생성 시점과 confirm 시점 사이에 규칙이 바뀌었을 가능성 방어)
 *   4) optimistic claim: status=awaiting_approval → approved 를 WHERE 조건 update 로
 *      원자적으로 차지한다. 이미 다른 요청이 처리 중이면 여기서 걸러진다.
 *   5) memos insert. 실패 시 pending_action 을 awaiting_approval 로 되돌린다 (rollback).
 *   6) pending_action 을 executed + result=memo_saved 로 확정.
 *   7) 감사 로그 기록.
 */
export async function executeApprovedMemo(
  pendingActionId: string,
  ctx: ExecuteMemoContext,
): Promise<ExecuteMemoResult> {
  const service = createServiceClient();

  const { data: pending, error: loadErr } = await service
    .from("pending_actions")
    .select(
      "id, user_id, action_type, target_type, status, payload, sensitivity_flag",
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
  if (pending.status !== "awaiting_approval") {
    return { status: "error", reason: `invalid_status:${pending.status}` };
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
