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

export type MemoApprovalRejectIdempotentParams = {
  actor_id: string;
  actor_email?: string | null;
  pending_action_id: string;
};

/** 이미 rejected 인 요청에 대해 재거절 시도(저장 없음). */
export async function logMemoApprovalRejectIdempotent(
  params: MemoApprovalRejectIdempotentParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.approval.reject_idempotent",
    result: "success",
    module_name: "memos.approval",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "pending_action",
    target_id: params.pending_action_id,
  });
}

export type MemoApprovalConfirmIdempotentParams = {
  actor_id: string;
  actor_email?: string | null;
  pending_action_id: string;
  memo_id: string;
};

/** 이미 executed 인 pending 에 대해 confirm 재시도(추가 memos 쓰기 없음). */
export async function logMemoApprovalConfirmIdempotent(
  params: MemoApprovalConfirmIdempotentParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.approval.confirm_idempotent",
    result: "success",
    module_name: "memos.approval",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    metadata: { pending_action_id: params.pending_action_id },
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
  /** 표시용 전략 라벨 (rule_based_v1, gemini, fallback 등). */
  strategy: string;
  metadata?: Record<string, unknown> | null;
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
    metadata: {
      strategy: params.strategy,
      ...((params.metadata as Record<string, unknown> | null | undefined) ?? {}),
    },
  });
}

export type SummarizerRequestParams = {
  actor_id: string;
  actor_email?: string | null;
  resource_id: string;
  resource_kind?: string;
  content_length: number;
  title_present: boolean;
  intended_provider: "gemini" | "rule" | "auto";
  regenerate?: boolean;
};

export async function logSummarizerRequestReceived(
  params: SummarizerRequestParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "summarizer.request.received",
    result: "success",
    module_name: "summarizer",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: params.resource_kind ?? "memo",
    target_id: params.resource_id,
    metadata: {
      content_length: params.content_length,
      title_present: params.title_present,
      intended_provider: params.intended_provider,
      resource_kind: params.resource_kind ?? "memo",
      regenerate: params.regenerate ?? null,
      phase: "started",
    },
  });
}

export type SummarizerSafetyEvaluatedParams = {
  actor_id: string;
  actor_email?: string | null;
  resource_id: string;
  resource_kind: string;
  allow_provider: boolean;
  policy_blocked: boolean;
  policy_reason?: string | null;
  warning: boolean;
  sensitivity_categories: string[];
};

export async function logSummarizerSafetyEvaluated(
  params: SummarizerSafetyEvaluatedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "summarizer.safety.evaluated",
    result: params.policy_blocked ? "failure" : "success",
    module_name: "summarizer.safety",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: params.resource_kind,
    target_id: params.resource_id,
    metadata: {
      allow_provider: params.allow_provider,
      policy_blocked: params.policy_blocked,
      policy_reason: params.policy_reason ?? null,
      warning: params.warning,
      sensitivity_categories: params.sensitivity_categories,
    },
  });
}

export type SummarizerProviderResolvedParams = {
  actor_id: string;
  actor_email?: string | null;
  resource_id: string;
  resource_kind?: string;
  provider: string;
  model: string | null;
  strategy: string;
  chunked?: boolean;
  chunk_count?: number | null;
  safety_skipped_provider?: boolean;
  extra_metadata?: Record<string, unknown> | null;
};

export async function logSummarizerProviderResolved(
  params: SummarizerProviderResolvedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "summarizer.provider.resolved",
    result: "success",
    module_name: "summarizer",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: params.resource_kind ?? "memo",
    target_id: params.resource_id,
    metadata: {
      provider: params.provider,
      model: params.model,
      strategy: params.strategy,
      chunked: params.chunked ?? null,
      chunk_count: params.chunk_count ?? null,
      safety_skipped_provider: params.safety_skipped_provider ?? null,
      ...(params.extra_metadata ?? {}),
    },
  });
}

export type SummarizerGeminiFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  resource_id: string;
  error_code: string;
  error_message?: string | null;
};

export async function logSummarizerGeminiFailed(
  params: SummarizerGeminiFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "summarizer.gemini.failed",
    result: "failure",
    module_name: "summarizer.gemini",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "summarizer",
    target_id: params.resource_id,
    error_code: params.error_code,
    error_message: params.error_message ?? null,
  });
}

export type SummarizerFallbackParams = {
  actor_id: string;
  actor_email?: string | null;
  resource_id: string;
  from_provider: string;
  to_provider: string;
  reason: string;
};

export async function logSummarizerFallbackUsed(
  params: SummarizerFallbackParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "summarizer.fallback.used",
    result: "success",
    module_name: "summarizer",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "summarizer",
    target_id: params.resource_id,
    metadata: {
      from_provider: params.from_provider,
      to_provider: params.to_provider,
      reason: params.reason,
    },
  });
}

export type MemoSummaryPersistFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  memo_id: string;
  error_message?: string | null;
};

export async function logMemoSummaryPersistFailed(
  params: MemoSummaryPersistFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.summary.persist.failed",
    result: "failure",
    module_name: "memos.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    error_code: "persist_failed",
    error_message: params.error_message ?? null,
  });
}

export type MemoReadSource = "api" | "rsc" | "assistant";

export type MemoListReadParams = {
  actor_id: string;
  actor_email?: string | null;
  source: MemoReadSource;
  result_count: number;
  sort: "created_at" | "updated_at";
  has_cursor: boolean;
  project_key?: string | null;
};

/**
 * GET 목록(또는 RSC)에서 메모를 조회했을 때. result_count 는 반환된 행 수. 원문 미포함.
 */
export async function logMemoListRead(params: MemoListReadParams): Promise<void> {
  await writeAuditLog({
    event_type: "memo.read.list",
    result: "success",
    module_name: "memos.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memos",
    metadata: {
      source: params.source,
      result_count: params.result_count,
      sort: params.sort,
      has_cursor: params.has_cursor,
      project_key: params.project_key ?? null,
    },
  });
}

export type MemoDetailReadParams = {
  actor_id: string;
  actor_email?: string | null;
  source: MemoReadSource;
  memo_id: string;
};

export async function logMemoDetailRead(params: MemoDetailReadParams): Promise<void> {
  await writeAuditLog({
    event_type: "memo.read.detail",
    result: "success",
    module_name: "memos.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    metadata: { source: params.source },
  });
}

export type MemoSearchedParams = {
  actor_id: string;
  actor_email?: string | null;
  source: MemoReadSource;
  result_count: number;
  query_len: number;
  project_key?: string | null;
  tag?: string | null;
};

/**
 * full-text 쿼리 원문은 남기지 않고 길이만.
 */
export async function logMemoSearched(params: MemoSearchedParams): Promise<void> {
  await writeAuditLog({
    event_type: "memo.searched",
    result: "success",
    module_name: "memos.search",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memos",
    metadata: {
      source: params.source,
      result_count: params.result_count,
      query_len: params.query_len,
      project_key: params.project_key ?? null,
      tag: params.tag ?? null,
    },
  });
}

export type MemoReadMissingParams = {
  actor_id: string;
  actor_email?: string | null;
  source: MemoReadSource;
  memo_id: string;
};

/**
 * 단건 조회가 빈 값으로 끝났을 때 (RLS/소유권/존재하지 않음 구분은 하지 않음).
 * 무차별 본문 열람 시도에 대한 흔적용.
 */
export async function logMemoReadMissing(
  params: MemoReadMissingParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.read.missing",
    result: "failure",
    module_name: "memos.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    error_code: "not_found",
    metadata: { source: params.source },
  });
}

export type MemoSummarizeSkippedParams = {
  actor_id: string;
  actor_email?: string | null;
  memo_id: string;
  reason: "if_empty_already_set";
  strategy: string;
};

export type MemoSummarizePolicyBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  memo_id: string;
  policy_reason: string;
};

export async function logMemoSummarizePolicyBlocked(
  params: MemoSummarizePolicyBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.summarize.policy_blocked",
    result: "failure",
    module_name: "memos.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    error_code: params.policy_reason,
    metadata: { policy_reason: params.policy_reason },
  });
}

/**
 * if_empty 모드에서 이미 summary 가 있어 요약을 생략한 경우. 별도 `memo.summarized` 는 남기지 않는다.
 */
export async function logMemoSummarizeSkipped(
  params: MemoSummarizeSkippedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "memo.summarize.skipped",
    result: "success",
    module_name: "memos.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "memo",
    target_id: params.memo_id,
    metadata: { reason: params.reason, strategy: params.strategy },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Document helpers
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentReadSource = "api" | "rsc" | "assistant";

export type DocumentReadStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
};

export async function logDocumentReadStarted(
  params: DocumentReadStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.started",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: { source: params.source },
  });
}

export type DocumentReadDetailParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
  chunk_count: number;
  has_summary: boolean;
  summary_id_prefix?: string | null;
  has_comparison?: boolean;
  has_analysis?: boolean;
};

export async function logDocumentReadDetail(
  params: DocumentReadDetailParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.detail",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      source: params.source,
      chunk_count: params.chunk_count,
      has_summary: params.has_summary,
      summary_id_prefix: params.summary_id_prefix ?? null,
      has_comparison: params.has_comparison ?? false,
      has_analysis: params.has_analysis ?? false,
    },
  });
}

export type DocumentReadMissingParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
};

export async function logDocumentReadMissing(
  params: DocumentReadMissingParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.missing",
    result: "failure",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: "not_found",
    metadata: { source: params.source },
  });
}

export type DocumentReadForbiddenParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
};

export async function logDocumentReadForbidden(
  params: DocumentReadForbiddenParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.forbidden",
    result: "failure",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: "forbidden",
    metadata: { source: params.source },
  });
}

export type DocumentReadSummaryFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
  error_message?: string | null;
};

export async function logDocumentReadSummaryFailed(
  params: DocumentReadSummaryFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.summary_failed",
    result: "failure",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_message: params.error_message?.slice(0, 200) ?? null,
    metadata: { source: params.source },
  });
}

export type DocumentListReadStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  source: DocumentReadSource;
};

export async function logDocumentListReadStarted(
  params: DocumentListReadStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.list_started",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "documents",
    metadata: { source: params.source },
  });
}

export type DocumentListReadParams = {
  actor_id: string;
  actor_email?: string | null;
  source: DocumentReadSource;
  result_count: number;
  sort: "created_at" | "updated_at";
  has_cursor: boolean;
};

export async function logDocumentListRead(params: DocumentListReadParams): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.list",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "documents",
    metadata: {
      source: params.source,
      result_count: params.result_count,
      sort: params.sort,
      has_cursor: params.has_cursor,
    },
  });
}

export type DocumentListReadFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  source: DocumentReadSource;
  error_code: string;
  error_message?: string | null;
};

export async function logDocumentListReadFailed(
  params: DocumentListReadFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.list_failed",
    result: "failure",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "documents",
    error_code: params.error_code,
    error_message: params.error_message?.slice(0, 200) ?? null,
    metadata: { source: params.source },
  });
}

export type DocumentReadSummariesStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
  type_filter: string;
  latest: boolean;
  limit?: number | null;
};

export async function logDocumentReadSummariesStarted(
  params: DocumentReadSummariesStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.summaries_started",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      source: params.source,
      type_filter: params.type_filter,
      latest: params.latest,
      limit: params.limit ?? null,
    },
  });
}

export type DocumentReadSummariesParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
  type_filter: string;
  latest: boolean;
  item_count: number;
  has_latest_block: boolean;
};

export async function logDocumentReadSummaries(
  params: DocumentReadSummariesParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.summaries",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      source: params.source,
      type_filter: params.type_filter,
      latest: params.latest,
      item_count: params.item_count,
      has_latest_block: params.has_latest_block,
    },
  });
}

export type DocumentReadSummariesFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  source: DocumentReadSource;
  error_code: string;
  error_message?: string | null;
};

export async function logDocumentReadSummariesFailed(
  params: DocumentReadSummariesFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.summaries_failed",
    result: "failure",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: params.error_code,
    error_message: params.error_message?.slice(0, 200) ?? null,
    metadata: { source: params.source },
  });
}

export async function logComparisonHistoryListRead(params: {
  actor_id: string;
  actor_email?: string | null;
  context: "document" | "global";
  context_document_id?: string | null;
  result_count: number;
  has_more: boolean;
  sort: string;
  role_filter?: string;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.comparisons",
    result: "success",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "comparison_history_list",
    metadata: {
      context: params.context,
      context_document_id: params.context_document_id ?? null,
      result_count: params.result_count,
      has_more: params.has_more,
      sort: params.sort,
      role_filter: params.role_filter ?? "all",
    },
  });
}

export async function logComparisonHistoryListReadFailed(params: {
  actor_id: string;
  actor_email?: string | null;
  error_code: string;
  error_message?: string | null;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.read.comparisons_failed",
    result: "failure",
    module_name: "documents.read",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "comparison_history_list",
    error_code: params.error_code,
    error_message: params.error_message?.slice(0, 200) ?? null,
  });
}

export async function logComparisonBookmarkAdded(params: {
  actor_id: string;
  actor_email?: string | null;
  comparison_id: string;
}): Promise<void> {
  await writeAuditLog({
    event_type: "comparison.bookmark.added",
    result: "success",
    module_name: "comparisons.bookmark",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "comparison_history",
    target_id: params.comparison_id,
  });
}

export async function logComparisonBookmarkRemoved(params: {
  actor_id: string;
  actor_email?: string | null;
  comparison_id: string;
}): Promise<void> {
  await writeAuditLog({
    event_type: "comparison.bookmark.removed",
    result: "success",
    module_name: "comparisons.bookmark",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "comparison_history",
    target_id: params.comparison_id,
  });
}

export async function logComparisonBookmarkFailed(params: {
  actor_id: string;
  actor_email?: string | null;
  comparison_id: string;
  error_code: string;
  error_message?: string | null;
}): Promise<void> {
  await writeAuditLog({
    event_type: "comparison.bookmark.failed",
    result: "failure",
    module_name: "comparisons.bookmark",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "comparison_history",
    target_id: params.comparison_id,
    error_code: params.error_code,
    error_message: params.error_message?.slice(0, 200) ?? null,
  });
}

// ── document compare / analyze ───────────────────────────────────────────────

export type DocumentCompareStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_ids: string[];
};

export async function logDocumentCompareStarted(
  params: DocumentCompareStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.compare.started",
    result: "success",
    module_name: "documents.compare",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_ids[0] ?? null,
    metadata: {
      doc_count: params.document_ids.length,
      id_prefixes: params.document_ids.map((id) => id.slice(0, 8)),
    },
  });
}

export type DocumentCompareCompletedParams = {
  actor_id: string;
  actor_email?: string | null;
  primary_document_id: string;
  compared_document_ids: string[];
  provider: string;
  chunked: boolean;
};

export async function logDocumentCompareCompleted(
  params: DocumentCompareCompletedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.compare.completed",
    result: "success",
    module_name: "documents.compare",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.primary_document_id,
    metadata: {
      compared_count: params.compared_document_ids.length,
      provider: params.provider,
      chunked: params.chunked,
    },
  });
}

export async function logDocumentComparePolicyBlocked(params: {
  actor_id: string;
  actor_email?: string | null;
  reason: string;
  document_ids?: string[];
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.compare.policy_blocked",
    result: "failure",
    module_name: "documents.compare",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    error_code: params.reason,
    metadata: { id_count: params.document_ids?.length ?? 0 },
  });
}

export async function logDocumentCompareFailed(params: {
  actor_id: string;
  actor_email?: string | null;
  reason: string;
  primary_document_id?: string | null;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.compare.failed",
    result: "failure",
    module_name: "documents.compare",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.primary_document_id ?? null,
    error_code: params.reason,
  });
}

export async function logDocumentCompareHistorySaved(params: {
  actor_id: string;
  actor_email?: string | null;
  comparison_history_id: string;
  summary_id: string | null;
  document_count: number;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.compare.history_saved",
    result: "success",
    module_name: "documents.compare",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "comparison_history",
    target_id: params.comparison_history_id,
    metadata: {
      summary_id: params.summary_id,
      document_count: params.document_count,
    },
  });
}

export async function logDocumentCompareHistoryFailed(params: {
  actor_id: string;
  actor_email?: string | null;
  reason: string;
  primary_document_id?: string | null;
  error_message?: string | null;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.compare.history_failed",
    result: "failure",
    module_name: "documents.compare",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.primary_document_id ?? null,
    error_code: params.reason,
    error_message: params.error_message?.slice(0, 200) ?? null,
  });
}

export type DocumentAnalyzeStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
};

export async function logDocumentAnalyzeStarted(
  params: DocumentAnalyzeStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.analyze.started",
    result: "success",
    module_name: "documents.analyze",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
  });
}

export type DocumentAnalyzeCompletedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  provider: string;
  chunked: boolean;
};

export async function logDocumentAnalyzeCompleted(
  params: DocumentAnalyzeCompletedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.analyze.completed",
    result: "success",
    module_name: "documents.analyze",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: { provider: params.provider, chunked: params.chunked },
  });
}

export async function logDocumentAnalyzePolicyBlocked(params: {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  reason: string;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.analyze.policy_blocked",
    result: "failure",
    module_name: "documents.analyze",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: params.reason,
  });
}

export async function logDocumentAnalyzeFailed(params: {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  reason: string;
}): Promise<void> {
  await writeAuditLog({
    event_type: "document.analyze.failed",
    result: "failure",
    module_name: "documents.analyze",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: params.reason,
  });
}

export type DocumentUploadStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  file_name: string;
  file_size: number;
  declared_mime: string;
};

export async function logDocumentUploadStarted(
  params: DocumentUploadStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.started",
    result: "success",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: null,
    metadata: {
      file_name: params.file_name,
      file_size: params.file_size,
      declared_mime: params.declared_mime,
    },
  });
}

export type DocumentUploadRowCreatedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  sha256_prefix: string;
};

export async function logDocumentUploadRowCreated(
  params: DocumentUploadRowCreatedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.row_created",
    result: "success",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: { sha256_prefix: params.sha256_prefix },
  });
}

export type DocumentUploadStorageParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  storage_path: string;
  error_message?: string | null;
};

export async function logDocumentUploadStorageSucceeded(
  params: DocumentUploadStorageParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.storage_succeeded",
    result: "success",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: { storage_path: params.storage_path },
  });
}

export async function logDocumentUploadStorageFailed(
  params: DocumentUploadStorageParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.storage_failed",
    result: "failure",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_message: params.error_message ?? null,
    metadata: { storage_path: params.storage_path },
  });
}

export type DocumentUploadParsingParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  outcome: string;
  chunk_count?: number | null;
  error_code?: string | null;
};

export type DocumentUploadParsingStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
};

export async function logDocumentUploadParsingStarted(
  params: DocumentUploadParsingStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.parsing_started",
    result: "success",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: null,
  });
}

export async function logDocumentUploadParsingCompleted(
  params: DocumentUploadParsingParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.parsing_completed",
    result: "success",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      outcome: params.outcome,
      chunk_count: params.chunk_count ?? null,
      error_code: params.error_code ?? null,
    },
  });
}

export async function logDocumentUploadParsingFailed(
  params: DocumentUploadParsingParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.parsing_failed",
    result: "failure",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: params.error_code ?? null,
    metadata: { outcome: params.outcome },
  });
}

export type DocumentUploadPreprocessingBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  reason: string;
};

export async function logDocumentUploadPreprocessingBlocked(
  params: DocumentUploadPreprocessingBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.preprocessing_blocked",
    result: "failure",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: params.reason,
  });
}

export type DocumentUploadCompletedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  chunk_count: number;
  parsed_text_truncated: boolean;
};

export async function logDocumentUploadCompleted(
  params: DocumentUploadCompletedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.completed",
    result: "success",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      chunk_count: params.chunk_count,
      parsed_text_truncated: params.parsed_text_truncated,
    },
  });
}

export type DocumentUploadFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id?: string | null;
  reason: string;
};

export async function logDocumentUploadFailed(
  params: DocumentUploadFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.upload.failed",
    result: "failure",
    module_name: "documents.upload",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id ?? null,
    error_code: params.reason,
  });
}

export type DocumentSummarizeStartedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  regenerate: boolean;
  input_source: "document_chunks" | "parsed_text";
  chunk_row_count: number | null;
  sanitized_content_length: number;
};

export async function logDocumentSummarizeStarted(
  params: DocumentSummarizeStartedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.summarize.started",
    result: "success",
    module_name: "documents.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      regenerate: params.regenerate,
      input_source: params.input_source,
      chunk_row_count: params.chunk_row_count,
      sanitized_content_length: params.sanitized_content_length,
    },
  });
}

export type DocumentSummarizeSkippedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  reason: "if_empty_already_set";
};

export async function logDocumentSummarizeSkipped(
  params: DocumentSummarizeSkippedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.summarize.skipped",
    result: "success",
    module_name: "documents.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: { reason: params.reason },
  });
}

export type DocumentSummarizePolicyBlockedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  policy_reason: string;
};

export async function logDocumentSummarizePolicyBlocked(
  params: DocumentSummarizePolicyBlockedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.summarize.policy_blocked",
    result: "failure",
    module_name: "documents.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: params.policy_reason,
    metadata: { policy_reason: params.policy_reason },
  });
}

export type DocumentSummarizedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  strategy: string;
  metadata?: Record<string, unknown> | null;
};

export async function logDocumentSummarized(
  params: DocumentSummarizedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.summarized",
    result: "success",
    module_name: "documents.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    metadata: {
      strategy: params.strategy,
      ...((params.metadata as Record<string, unknown> | null | undefined) ?? {}),
    },
  });
}

export type DocumentSummaryPersistFailedParams = {
  actor_id: string;
  actor_email?: string | null;
  document_id: string;
  error_message?: string | null;
};

export async function logDocumentSummaryPersistFailed(
  params: DocumentSummaryPersistFailedParams,
): Promise<void> {
  await writeAuditLog({
    event_type: "document.summary.persist.failed",
    result: "failure",
    module_name: "documents.summarize",
    actor_type: "user",
    actor_id: params.actor_id,
    actor_email: params.actor_email ?? null,
    target_type: "document",
    target_id: params.document_id,
    error_code: "persist_failed",
    error_message: params.error_message ?? null,
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
