import "server-only";

import type { AuditLogRecord, PolicyLogRecord } from "./types";

/**
 * 로그 writer 추상화.
 *
 * - 현재 구현은 `console` 출력뿐이지만, DB writer(Supabase service role → `audit_logs`
 *   테이블 insert 등) 로 교체하기 쉽도록 인터페이스를 고정해 둔다.
 * - writer 구현은 절대 throw 하지 않도록 작성한다. 상위의 writeAuditLog/writePolicyLog 가
 *   한 번 더 방어하지만, writer 단계에서도 최대한 내부 try/catch 로 막는다.
 */
export interface LogWriter {
  writeAudit(record: AuditLogRecord): Promise<void>;
  writePolicy(record: PolicyLogRecord): Promise<void>;
}

/**
 * 기본 writer: 구조화된 JSON 을 stdout/stderr 로 출력한다.
 * 서버 환경에서 Vercel/Next 서버 로그로 자동 수집된다.
 */
export const consoleWriter: LogWriter = {
  async writeAudit(record) {
    const line = safeStringify(record);
    if (record.result === "failure") {
      console.error("[audit]", line);
    } else {
      console.info("[audit]", line);
    }
  },
  async writePolicy(record) {
    const line = safeStringify(record);
    if (record.decision === "denied") {
      console.warn("[policy]", line);
    } else {
      console.info("[policy]", line);
    }
  },
};

let currentWriter: LogWriter = consoleWriter;

/**
 * 런타임에 writer 를 교체한다. DB writer 나 테스트용 in-memory writer 로 바꿀 때 사용.
 * 호출 순서 경쟁을 피하기 위해 앱 부팅 시점에 한 번만 호출하는 것을 권장한다.
 */
export function setLogWriter(writer: LogWriter): void {
  currentWriter = writer;
}

export function getLogWriter(): LogWriter {
  return currentWriter;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    // 순환 참조 등으로 직렬화 실패 시에도 최소 정보는 남긴다.
    return String(value);
  }
}
