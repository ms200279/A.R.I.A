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
