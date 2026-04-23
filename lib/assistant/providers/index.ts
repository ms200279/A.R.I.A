import "server-only";

import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import type { AssistantProvider } from "./types";

/**
 * Provider 선택 / 구성.
 *
 * ASSISTANT_PROVIDER 환경변수로 분기한다. 기본값은 "gemini".
 * 한 번 선택된 provider 는 요청별 인스턴스로 돌려준다(캐시하지 않는다).
 *  - 캐시하면 key rotation / 모델 변경 때 서버 재시작이 필요해진다.
 *
 * resolveProvider 는 env 미설정/잘못된 설정을 throw 한다.
 * 호출부(run-assistant)는 이를 catch 해서 provider_error 로 정규화한다.
 */

export type ProviderName = "gemini" | "openai";

const DEFAULT_PROVIDER: ProviderName = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-5.4";

export function resolveProviderName(): ProviderName {
  const raw = (process.env.ASSISTANT_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "gemini" || raw === "openai") return raw;
  return DEFAULT_PROVIDER;
}

export function resolveProvider(): AssistantProvider {
  const name = resolveProviderName();
  if (name === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing required env var: GEMINI_API_KEY");
    }
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    return new GeminiProvider({ apiKey, model });
  }

  // openai
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  return new OpenAIProvider({ apiKey, model });
}

export { GeminiProvider } from "./gemini";
export { OpenAIProvider } from "./openai";
export type {
  AssistantProvider,
  AssistantProviderRunInput,
  AssistantProviderRunResult,
  NeutralTool,
  ProviderToolExecutor,
} from "./types";
