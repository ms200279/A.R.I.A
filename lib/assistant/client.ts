import "server-only";

/**
 * Assistant runner 가 공용으로 쓰는 환경변수 헬퍼.
 *
 * Provider 인스턴스화는 `lib/assistant/providers/index.ts` 의 `resolveProvider()` 에서 담당한다.
 * 이 파일은 provider 중립적인 설정만 노출한다.
 *
 * 사용 규칙:
 *  - 절대 브라우저/Client Component 에서 import 하지 않는다. `server-only` 가드로 강제한다.
 *  - 모든 모델 호출은 `lib/assistant/run-assistant.ts` 같은 서버 측 오케스트레이션 모듈에서만 수행한다.
 *  - 키/모델명은 환경변수로만 주입한다. 리터럴 하드코딩 금지.
 */

export function resolveMaxIterations(): number {
  const raw = process.env.ASSISTANT_MAX_ITERATIONS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 12) return parsed;
  return 5;
}
