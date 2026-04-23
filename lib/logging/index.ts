import "server-only";

/**
 * lib/logging
 *
 * 구조화 감사/정책 로그 진입점.
 *
 * 기본 원칙:
 *  - 원문/토큰/비밀키는 어떤 로그에도 포함하지 않는다. 필요한 경우 해시/포인터만.
 *  - 모든 함수는 서버에서만 호출된다 (`server-only` 가드).
 *  - writer 구현은 절대 throw 하지 않는다. 상위 writeAuditLog/writePolicyLog 가
 *    한 번 더 try/catch 로 방어한다. 메인 흐름은 로깅 실패와 무관해야 한다.
 *
 * 확장 포인트:
 *  - DB writer 로 교체 시 `setLogWriter()` 한 번 호출로 끝난다. DB writer 는
 *    `@supabase/supabase-js` 의 service role 클라이언트를 써서 `audit_logs` /
 *    `policy_events` 에 insert 하는 식으로 구현한다.
 *  - 새로운 도메인(메모/문서/메일 등) 은 `audit-log.ts` 에 helper 를 추가한다.
 *  - proxy 또는 보호 라우트 차단 지점 로깅은 이후 단계에서 이 모듈을 import 해서
 *    `auth.access_denied` 같은 event_type 을 늘리는 식으로 연결한다. (TODO)
 */

export type {
  AuditEventType,
  AuditResult,
  ActorType,
  AuditLogInput,
  AuditLogRecord,
  PolicyDecision,
  PolicyLogInput,
  PolicyLogRecord,
} from "./types";

export type { LogWriter } from "./writer";
export { consoleWriter, setLogWriter, getLogWriter } from "./writer";

export {
  writeAuditLog,
  logAuthCallbackSuccess,
  logAuthCallbackFailure,
  logLogoutSuccess,
  logLogoutFailure,
} from "./audit-log";

export { writePolicyLog } from "./policy-log";
