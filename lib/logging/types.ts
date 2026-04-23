import "server-only";

/**
 * 구조화 로깅 타입.
 *
 * 필드명은 snake_case 로 고정한다. 추후 Supabase `audit_logs` / `policy_events` 테이블
 * 컬럼과 1:1 매핑되어 DB writer 로 교체할 때 번역 계층이 필요 없게 하기 위함이다.
 *
 * 원칙:
 * - 원문/토큰/비밀키는 절대 포함하지 않는다. 필요한 경우 해시/포인터만.
 * - `metadata` 는 자유 포맷 JSON. 민감 정보 여부를 호출부에서 스스로 책임진다.
 * - 타입은 "수신 가능 값의 상한" 이지 "필수 필드" 가 아니다. null 허용 필드는 명시.
 */

export type AuditResult = "success" | "failure";

/**
 * 감사 로그 이벤트 타입. 현재 단계는 auth 경로만 정의한다.
 * 도메인 기능(승인/메모/메일 등) 확장 시 신규 리터럴을 추가한다.
 */
export type AuditEventType =
  | "auth.callback.succeeded"
  | "auth.callback.failed"
  | "auth.logout.succeeded"
  | "auth.logout.failed"
  | "memo.create.requested"
  | "memo.create.blocked"
  | "memo.create.pending"
  | "memo.approval.executed"
  | "memo.approval.rejected"
  | "memo.approval.blocked"
  | "memo.summarized"
  | "memo.read.list"
  | "memo.read.detail"
  | "memo.searched"
  | "memo.read.missing"
  | "memo.summarize.skipped"
  | "memo.summarize.policy_blocked"
  | "memo.summary.persist.failed"
  | "summarizer.request.received"
  | "summarizer.safety.evaluated"
  | "summarizer.provider.resolved"
  | "summarizer.gemini.failed"
  | "summarizer.fallback.used"
  | "assistant.request.received"
  | "assistant.tool.invoked"
  | "assistant.tool.blocked"
  | "assistant.run.completed"
  | "assistant.run.failed"
  | "assistant.policy.blocked"
  | "assistant.provider.error"
  | "assistant.proposal.generated"
  | "assistant.save_intent.blocked"
  | "assistant.pending_action.created"
  | "document.summarize.started"
  | "document.summarize.skipped"
  | "document.summarize.policy_blocked"
  | "document.summarized"
  | "document.summary.persist.failed";

export type ActorType = "user" | "anonymous" | "system" | "service";

export type AuditLogInput = {
  event_type: AuditEventType;
  result: AuditResult;
  /** 모듈/경로 라벨. 예: "auth.callback", "auth.logout". 라우팅 구조와 느슨하게 매핑. */
  module_name: string;
  actor_type: ActorType;
  actor_id?: string | null;
  actor_email?: string | null;
  /** 대상 리소스 종류 (예: "auth_session", "pending_action"). 없으면 null. */
  target_type?: string | null;
  target_id?: string | null;
  /** 자유 포맷 JSON. 민감 정보 제외. */
  metadata?: Record<string, unknown> | null;
  /** 실패 시 분류용 짧은 코드. 성공 시 null/undefined. */
  error_code?: string | null;
  /** 공급자/라이브러리에서 온 원본 에러 메시지. 민감하지 않아야 한다. */
  error_message?: string | null;
};

export type AuditLogRecord = AuditLogInput & {
  /** ISO-8601 문자열. writer 진입 시 자동 주입. */
  occurred_at: string;
};

/**
 * 정책/승인 이벤트 로그 골격.
 * 정책 도메인 착수 시 event_type 을 구체적 union 으로 좁히고 rule 체계를 정식화한다.
 */
export type PolicyDecision = "allowed" | "denied" | "requires_approval";

export type PolicyLogInput = {
  /** 정책 이벤트 타입. 초기 단계에서는 freeform string 으로 둔다. */
  event_type: string;
  module_name: string;
  actor_type: ActorType;
  actor_id?: string | null;
  decision: PolicyDecision;
  /** 위반/적용된 규칙 식별자. 예: "write.requires_approval". */
  rule?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PolicyLogRecord = PolicyLogInput & {
  occurred_at: string;
};
