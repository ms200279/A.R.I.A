import "server-only";

import type { PolicyLogInput, PolicyLogRecord } from "./types";
import { getLogWriter } from "./writer";

/**
 * 정책/승인 이벤트 로그 골격.
 *
 * 이번 단계에서는 호출부가 없다. 정책 도메인(lib/policies) 이 착수되는 시점에
 * 구체적 event_type / rule 체계를 확정하고 여기서 호출한다.
 *
 * writeAuditLog 과 동일하게 throw 하지 않는다. DB writer 교체 후에도 정책 엔진의 주요
 * 흐름(허용/거부/승인요청 결정) 자체는 로깅 실패와 무관해야 한다.
 */
export async function writePolicyLog(input: PolicyLogInput): Promise<void> {
  const record: PolicyLogRecord = {
    ...input,
    occurred_at: new Date().toISOString(),
  };

  try {
    await getLogWriter().writePolicy(record);
  } catch (err) {
    try {
      console.error(
        "[policy:writer_failed]",
        JSON.stringify({
          record,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } catch {
      // 직렬화 실패는 조용히 포기.
    }
  }
}
