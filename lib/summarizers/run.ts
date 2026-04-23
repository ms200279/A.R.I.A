import "server-only";

import { createGeminiSummarizer } from "./gemini-summarizer";
import { pickPrimaryForRun, resolveSummarizerEnv } from "./config";
import { createRuleBasedV1Summarizer } from "./rule-based-v1";
import type { SummarizerInput, SummarizerOutput } from "./types";

export type RunSummarizerWithDetails = {
  output: SummarizerOutput;
  /** 1차로 Gemini 를 시도했는데 throw 된 오류. 없으면 null. */
  geminiError: string | null;
  /** 1차로 시도한 쪽(gemini 시도 시도, rule 이면 rule-only). */
  attemptedPrimary: "gemini" | "rule";
};

/**
 * 환경 변수에 따라 1차 provider 를 고르고, Gemini 가 예외를 던지면 rule_based_v1 으로 복구한다.
 * `strategy === "fallback"` 이면 geminiError 가 비어 있지 않다(정상 rule-only 경로는 `geminiError === null` 이고 strategy 는 rule_based_v1).
 */
export async function runSummarizerWithFallback(
  input: SummarizerInput,
): Promise<RunSummarizerWithDetails> {
  const env = resolveSummarizerEnv();
  const primary = pickPrimaryForRun(env);
  const rule = createRuleBasedV1Summarizer();

  if (primary === "rule" || !env.geminiApiKey) {
    const output = await rule.summarize(input);
    return { output, geminiError: null, attemptedPrimary: "rule" };
  }

  const gemini = createGeminiSummarizer({
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
  });

  try {
    const output = await gemini.summarize(input);
    return { output, geminiError: null, attemptedPrimary: "gemini" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const base = await rule.summarize(input);
    const output: SummarizerOutput = {
      ...base,
      strategy: "fallback",
      metadata: {
        ...base.metadata,
        fallback_from: "gemini",
        fallback_to: "rule_based_v1",
        error_message: msg,
      },
    };
    return { output, geminiError: msg, attemptedPrimary: "gemini" };
  }
}

/**
 * 단위/테스트: 주입된 설정으로만 실행.
 */
export async function runSummarizerWithFallbackInjected(
  input: SummarizerInput,
  opts: {
    primary: "gemini" | "rule";
    gemini?: { apiKey: string; model: string } | null;
  },
): Promise<RunSummarizerWithDetails> {
  const rule = createRuleBasedV1Summarizer();
  if (opts.primary === "rule" || !opts.gemini?.apiKey) {
    const output = await rule.summarize(input);
    return { output, geminiError: null, attemptedPrimary: "rule" };
  }
  const gemini = createGeminiSummarizer(opts.gemini);
  try {
    const output = await gemini.summarize(input);
    return { output, geminiError: null, attemptedPrimary: "gemini" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const base = await rule.summarize(input);
    return {
      output: {
        ...base,
        strategy: "fallback",
        metadata: {
          ...base.metadata,
          fallback_from: "gemini",
          fallback_to: "rule_based_v1",
          error_message: msg,
        },
      },
      geminiError: msg,
      attemptedPrimary: "gemini",
    };
  }
}
