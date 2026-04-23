import "server-only";

/**
 * `SUMMARIZER_PROVIDER`:
 *   - `gemini`  : API 키가 없으면 자동으로 rule 로 떨어짐(런타임, 로그는 caller).
 *   - `rule`    : 항상 rule_based_v1.
 *   - `auto`    : (기본) GEMINI_API_KEY 가 있으면 gemini, 없으면 rule.
 *
 * `ASSISTANT_PROVIDER` 는 assistant 와의 일관을 위해, `SUMMARIZER_PROVIDER`가 비어 있을 때
 * `auto`의 보조 힌트로만 쓴다(예: openai-only 환경에서도 요약에 Gemini 키가 있으면 쓰고 싶을 때).
 */
export type SummarizerProviderChoice = "gemini" | "rule" | "auto";

const SUMMARY_MAX_CHARS_DB = 2000;

export function getSummaryMaxLengthForStore(): number {
  return SUMMARY_MAX_CHARS_DB;
}

export function resolveSummarizerEnv(): {
  /** 실행 시도할 1차 의도(실제 API 키 없으면 caller 가 rule 로 조정) */
  intended: SummarizerProviderChoice;
  geminiApiKey: string | null;
  geminiModel: string;
} {
  const raw = process.env.SUMMARIZER_PROVIDER?.trim().toLowerCase();
  const key = process.env.GEMINI_API_KEY?.trim() || null;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  let intended: SummarizerProviderChoice = "auto";
  if (raw === "gemini" || raw === "llm") {
    intended = "gemini";
  } else if (raw === "rule" || raw === "rule_based" || raw === "rule_based_v1") {
    intended = "rule";
  } else if (raw === "auto" || !raw) {
    intended = "auto";
  }

  return { intended, geminiApiKey: key, geminiModel: model };
}

/**
 * 실제로 **어느 구현**을 1차로 시도할지.
 */
export function pickPrimaryForRun(env: ReturnType<typeof resolveSummarizerEnv>): "gemini" | "rule" {
  if (env.intended === "rule") return "rule";
  if (env.intended === "gemini") {
    return env.geminiApiKey ? "gemini" : "rule";
  }
  // auto
  return env.geminiApiKey ? "gemini" : "rule";
}

/**
 * `logSummarizerRequestReceived` 의 `intended_provider` 필드용 라벨.
 */
export function intendedProviderLabel(
  env: ReturnType<typeof resolveSummarizerEnv>,
): "gemini" | "rule" | "auto" {
  if (env.intended === "auto") return "auto";
  if (env.intended === "rule") return "rule";
  return "gemini";
}
