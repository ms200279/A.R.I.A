import "server-only";

/**
 * lib/logging
 *
 * 감사 / 정책 위반 / 실행 로그 writer.
 *
 * 기본 원칙:
 *  - 원문을 그대로 저장하지 않는다. 요약/해시/포인터만.
 *  - 토큰/비밀키는 어떤 로그에도 포함하지 않는다.
 *  - 모든 함수는 서버에서만 호출된다 (`server-only` 가드).
 */

export type AuditEntry = {
  userId: string;
  action: string; // 예: "memo.create", "approval.confirm"
  target?: string; // 예: "pending_action:abc123"
  approvalId?: string | null;
  outcome: "success" | "failure";
  summary?: string; // 사람이 읽는 짧은 설명 (민감 정보 제외)
};

export type PolicyViolationEntry = {
  userId: string;
  action: string;
  reason: string;
  details?: Record<string, unknown>;
};

export type ExecutionEntry = {
  userId: string;
  approvalId: string;
  integration: string; // 예: "google-calendar"
  outcome: "success" | "failure";
  externalRefHash?: string; // 외부 시스템의 응답 id 를 해시한 값
};

export async function writeAudit(_entry: AuditEntry): Promise<void> {
  // TODO: service client 로 audit_log insert
  throw new Error("not_implemented: lib/logging.writeAudit");
}

export async function writePolicyViolation(_entry: PolicyViolationEntry): Promise<void> {
  // TODO: service client 로 policy_violation_log insert
  throw new Error("not_implemented: lib/logging.writePolicyViolation");
}

export async function writeExecution(_entry: ExecutionEntry): Promise<void> {
  // TODO: service client 로 execution_log insert
  throw new Error("not_implemented: lib/logging.writeExecution");
}
