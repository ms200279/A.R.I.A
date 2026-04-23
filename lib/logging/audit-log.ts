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

export type MemoApprovalBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  pending_action_id: string;
  reason: string;
  metadata?: Record<string, unknown>;
};

/**
 * confirm 단계에서 payload 재검증/정책 재검사가 실패해
 * pending_action 이 blocked 로 전이된 경우.
 * memos 테이블에는 어떤 쓰기도 일어나지 않는다.
 */
export async function logMemoApprovalBlocked(
  params: MemoApprovalBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.approval.blocked",
    result: "failure",
    module_name: "memos.approval",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "pending_action",
    target_id: params.pending_action_id,
    error_code: params.reason,
    metadata: params.metadata ?? null,
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

// ─────────────────────────────────────────────────────────────────────────────
// Assistant helpers
// ─────────────────────────────────────────────────────────────────────────────

export type AssistantRequestReceivedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  message_length: number;
};

export async function logAssistantRequestReceived(
  params: AssistantRequestReceivedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.request.received",
    result: "success",
    module_name: "assistant.query",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_run",
    metadata: {
      session_id: params.session_id ?? null,
      message_length: params.message_length,
    },
  });
}

export type AssistantToolInvokedParams = {
  actor_id: string;
  actor_email?: string | null;
  tool_name: string;
  tier: string;
  session_id?: string | null;
};

export async function logAssistantToolInvoked(
  params: AssistantToolInvokedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.tool.invoked",
    result: "success",
    module_name: "assistant.tool",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_tool",
    target_id: params.tool_name,
    metadata: {
      tier: params.tier,
      session_id: params.session_id ?? null,
    },
  });
}

export type AssistantToolBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  tool_name: string;
  reason: string;
};

export async function logAssistantToolBlocked(
  params: AssistantToolBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.tool.blocked",
    result: "failure",
    module_name: "assistant.tool",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_tool",
    target_id: params.tool_name,
    error_code: params.reason,
  });
}

export type AssistantRunCompletedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  answer_kind: string;
  iterations: number;
  pending_action_count: number;
  tool_call_count: number;
};

export async function logAssistantRunCompleted(
  params: AssistantRunCompletedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.run.completed",
    result: "success",
    module_name: "assistant.run",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_run",
    metadata: {
      session_id: params.session_id ?? null,
      answer_kind: params.answer_kind,
      iterations: params.iterations,
      pending_action_count: params.pending_action_count,
      tool_call_count: params.tool_call_count,
    },
  });
}

export type AssistantRunFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  error_code: string;
  error_message?: string | null;
};

export async function logAssistantRunFailed(
  params: AssistantRunFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.run.failed",
    result: "failure",
    module_name: "assistant.run",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_run",
    error_code: params.error_code,
    error_message: params.error_message ?? null,
    metadata: {
      session_id: params.session_id ?? null,
    },
  });
}

export type AssistantPolicyBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  reason: string;
  matched_pattern?: string | null;
};

/**
 * pre-gate 가 사용자 메시지를 정책 위반으로 판정해 LLM 호출 자체를 차단했을 때.
 * 메시지 원문은 남기지 않는다. 매칭 패턴/카테고리만 남긴다.
 */
export async function logAssistantPolicyBlocked(
  params: AssistantPolicyBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.policy.blocked",
    result: "failure",
    module_name: "assistant.policy",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_run",
    error_code: params.reason,
    metadata: {
      session_id: params.session_id ?? null,
      matched_pattern: params.matched_pattern ?? null,
    },
  });
}

export type AssistantProposalGeneratedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  tool_name: string;
  content_length: number;
  sensitivity_flag: boolean;
  sensitivity_categories: string[];
};

/**
 * propose_save_memo (preview-only) 가 실행되어 저장안 미리보기가 만들어졌을 때.
 * 아직 DB 에는 어떤 쓰기도 일어나지 않은 상태다.
 */
export async function logAssistantProposalGenerated(
  params: AssistantProposalGeneratedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.proposal.generated",
    result: "success",
    module_name: "assistant.proposal",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_proposal",
    target_id: params.tool_name,
    metadata: {
      session_id: params.session_id ?? null,
      content_length: params.content_length,
      sensitivity_flag: params.sensitivity_flag,
      sensitivity_categories: params.sensitivity_categories,
    },
  });
}

export type AssistantSaveIntentBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  reason: string;
};

/**
 * create_pending_action_for_memo 가 서버 측 intent 재검증에서 차단됐을 때.
 * 어떤 메시지가 매칭 실패했는지는 기록하지 않는다 (원문 미노출 정책).
 */
export async function logAssistantSaveIntentBlocked(
  params: AssistantSaveIntentBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.save_intent.blocked",
    result: "failure",
    module_name: "assistant.proposal",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_proposal",
    error_code: params.reason,
    metadata: {
      session_id: params.session_id ?? null,
    },
  });
}

export type AssistantPendingActionCreatedParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  pending_action_id: string;
  sensitivity_flag: boolean;
};

/**
 * create_pending_action_for_memo 가 pending_actions 레코드를 생성했을 때.
 * memos 테이블에는 아직 쓰이지 않은 상태다 (approval confirm 에서 실제 저장).
 */
export async function logAssistantPendingActionCreated(
  params: AssistantPendingActionCreatedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.pending_action.created",
    result: "success",
    module_name: "assistant.proposal",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "pending_action",
    target_id: params.pending_action_id,
    metadata: {
      session_id: params.session_id ?? null,
      sensitivity_flag: params.sensitivity_flag,
    },
  });
}

export type AssistantProviderErrorParams = {
  actor_id: string;
  actor_email?: string | null;
  session_id?: string | null;
  provider: string;
  error_message?: string | null;
};

/**
 * provider 호출이 실패했을 때. error_code 는 항상 "provider_error" 로 통일하고,
 * provider 식별자는 metadata.provider 에 둔다.
 */
export async function logAssistantProviderError(
  params: AssistantProviderErrorParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "assistant.provider.error",
    result: "failure",
    module_name: "assistant.provider",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "assistant_run",
    error_code: "provider_error",
    error_message: params.error_message ?? null,
    metadata: {
      session_id: params.session_id ?? null,
      provider: params.provider,
    },
  });
}
