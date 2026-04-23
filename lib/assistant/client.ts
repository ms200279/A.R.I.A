import "server-only";

import OpenAI from "openai";

/**
 * OpenAI 서버 전용 클라이언트.
 *
 * 사용 규칙:
 * - 절대 브라우저/Client Component 에서 import 하지 않는다. `server-only` 가드로 강제한다.
 * - 모든 모델 호출은 `lib/assistant/run-assistant.ts` 같은 서버 측 오케스트레이션 모듈에서만 수행한다.
 * - 키/모델명은 환경변수로만 주입한다. 리터럴 하드코딩 금지.
 */
export const DEFAULT_MODEL = "gpt-5.4";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

export function resolveModelName(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export function resolveMaxIterations(): number {
  const raw = process.env.ASSISTANT_MAX_ITERATIONS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 12) return parsed;
  return 5;
}
