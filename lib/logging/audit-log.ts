import "server-only";

import type { AuditLogInput, AuditLogRecord } from "./types";
import { getLogWriter } from "./writer";

/**
 * 감사 로그 1건을 기록한다.
 *
 * 절대 throw 하지 않는다. writer 가 실패해도 메인 흐름(로그인/콜백/로그아웃 등) 이 깨지지
 * 않도록 내부에서 모든 예외를 먹고 최소한의 fallback(`console.error`) 만 남긴다.
 * 호출부는 `await writeAuditLog(...)` 한 줄로 안전하게 사용할 수 있다.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const record: AuditLogRecord = {
    ...input,
    occurred_at: new Date().toISOString(),
  };

  try {
    await getLogWriter().writeAudit(record);
  } catch (err) {
    try {
      console.error(
        "[audit:writer_failed]",
        JSON.stringify({
          record,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } catch {
      // 직렬화조차 실패한 경우는 조용히 포기한다.
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Route Handler 는 얇게 유지한다는 정책에 따라, 공통 payload 구성은 이 helper 들이
// 담당한다. 호출부는 이름만 보고 의도를 파악할 수 있다.
//

export type AuthCallbackSuccessParams = {
  actor_id?: string | null;
  actor_email?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuthCallbackSuccess(
  params: AuthCallbackSuccessParams = {},
): Promise<void> {
  await writeAuditLog({
    event_type: "auth.callback.succeeded",
    result: "success",
    module_name: "auth.callback",
    actor_type: "user",
    actor_id: params.actor_id ?? null,
    actor_email: params.actor_email ?? null,
    target_type: "auth_session",
    target_id: params.actor_id ?? null,
    metadata: params.metadata ?? null,
  });
}

export type AuthCallbackFailureParams = {
  /** 실패 분류 코드. 예: "missing_code", "exchange_failed". */
  reason: string;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuthCallbackFailure(
  params: AuthCallbackFailureParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "auth.callback.failed",
    result: "failure",
    module_name: "auth.callback",
    actor_type: "anonymous",
    target_type: "auth_session",
    error_code: params.reason,
    error_message: params.error_message ?? null,
    metadata: params.metadata ?? null,
  });
}

export type LogoutSuccessParams = {
  actor_id?: string | null;
  actor_email?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logLogoutSuccess(
  params: LogoutSuccessParams = {},
): Promise<void> {
  await writeAuditLog({
    event_type: "auth.logout.succeeded",
    result: "success",
    module_name: "auth.logout",
    actor_type: "user",
    actor_id: params.actor_id ?? null,
    actor_email: params.actor_email ?? null,
    target_type: "auth_session",
    target_id: params.actor_id ?? null,
    metadata: params.metadata ?? null,
  });
}

export type LogoutFailureParams = {
  actor_id?: string | null;
  actor_email?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logLogoutFailure(
  params: LogoutFailureParams = {},
): Promise<void> {
  await writeAuditLog({
    event_type: "auth.logout.failed",
    result: "failure",
    module_name: "auth.logout",
    actor_type: params.actor_id ? "user" : "anonymous",
    actor_id: params.actor_id ?? null,
    actor_email: params.actor_email ?? null,
    target_type: "auth_session",
    target_id: params.actor_id ?? null,
    error_code: "signout_failed",
    error_message: params.error_message ?? null,
    metadata: params.metadata ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Memo helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// 메모 도메인의 주요 상태 전이(요청/차단/승인대기/실행/거절/요약)에 대응한다.
// 민감 원문은 절대 넘기지 않는다. 필요한 지표는 sensitivity_flag / category 수준.
//

export type MemoCreateRequestedParams = {
  actor_id: string;
  actor_email?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logMemoCreateRequested(
  params: MemoCreateRequestedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.create.requested",
    result: "success",
    module_name: "memos.create",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    metadata: params.metadata ?? null,
  });
}

export type MemoCreateBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
};

export async function logMemoCreateBlocked(
  params: MemoCreateBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.create.blocked",
    result: "failure",
    module_name: "memos.create",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    error_code: params.reason,
    metadata: params.metadata ?? null,
  });
}

export type MemoCreatePendingParams = {
  actor_id: string;
  actor_email?: string | null;
  pending_action_id: string;
  sensitivity_flag: boolean;
  metadata?: Record<string, unknown>;
};

export async function logMemoCreatePending(
  params: MemoCreatePendingParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.create.pending",
    result: "success",
    module_name: "memos.create",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "pending_action",
    target_id: params.pending_action_id,
    metadata: {
      sensitivity_flag: params.sensitivity_flag,
      ...params.metadata,
    },
  });
}

export type MemoApprovalExecutedParams = {
  actor_id: string;
  actor_email?: string | null;
  pending_action_id: string;
  memo_id: string;
  sensitivity_flag: boolean;
};

export async function logMemoApprovalExecuted(
  params: MemoApprovalExecutedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.approval.executed",
    result: "success",
    module_name: "memos.approval",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    metadata: {
      pending_action_id: params.pending_action_id,
      sensitivity_flag: params.sensitivity_flag,
    },
  });
}

export type MemoApprovalRejectedParams = {
  actor_id: string;
  actor_email?: string | null;
  pending_action_id: string;
};

export async function logMemoApprovalRejected(
  params: MemoApprovalRejectedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.approval.rejected",
    result: "success",
    module_name: "memos.approval",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "pending_action",
    target_id: params.pending_action_id,
  });
}

export type MemoSummarizedParams = {
  actor_id: string;
  actor_email?: string | null;
  memo_id: string;
  strategy: string;
};

export async function logMemoSummarized(
  params: MemoSummarizedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.summarized",
    result: "success",
    module_name: "memos.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    metadata: { strategy: params.strategy },
  });
}
