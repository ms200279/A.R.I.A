import "server-only";

import { evaluateMemoCreate, type MemoCreateIntent } from "@/lib/policies/memo";
import {
  detectSensitiveContent,
  type SensitivityCategory,
  type SensitivityMatch,
} from "@/lib/safety/sensitive";
/**
 * 주민번호·카드번호 패턴은 저장 자체를 막는다( 경고만으로는 부족한 수준).
 * 전화·API 키 유사 문자열은 플래그·승인 UI( `sensitivity_flag` )로 유지.
 */
const BLOCKED_ON_STORE: ReadonlySet<SensitivityCategory> = new Set(["korean_ssn", "credit_card"]);

/**
 * 서버 `memos` 행 insert 직전·저장안 생성 직전에 공통으로 사용.
 * - `explicit: false` → 항상 거절( 자동 기억 금지 ).
 * - 고위험 민감 패턴 → 저장 차단.
 * - 그 외 민감 힌트는 호출부에서 `sensitivity_flag` 로 이어감.
 */
export function validateExplicitMemoSaveRequest(
  intent: MemoCreateIntent,
  sensitivity: SensitivityMatch[] | undefined = undefined,
):
  | { ok: true; sensitivity: SensitivityMatch[] }
  | { ok: false; reason: string; sensitivity: SensitivityMatch[] } {
  const matches = sensitivity ?? detectSensitiveContent(intent.content ?? "");
  for (const m of matches) {
    if (BLOCKED_ON_STORE.has(m.category)) {
      return {
        ok: false,
        reason: "sensitive_high_risk",
        sensitivity: matches,
      };
    }
  }
  const ev = evaluateMemoCreate(
    {
      content: intent.content,
      title: intent.title,
      explicit: intent.explicit,
    },
    matches,
  );
  if (ev.decision === "block") {
    return { ok: false, reason: ev.reason, sensitivity: ev.sensitivity };
  }
  return { ok: true, sensitivity: matches };
}
