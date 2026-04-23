import "server-only";

import { logSummarizerSafetyEvaluated } from "@/lib/logging/audit-log";
import { evaluateSummarizerProviderGate } from "@/lib/safety/summarize-provider-gate";

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
  /** Gemini 가 구성되어 있으나 안전/정책 게이트로 호출을 생략했는지. */
  safetySkippedProvider: boolean;
};

function normalizeSummarizerInput(input: SummarizerInput): SummarizerInput {
  let regenerate = input.regenerate;
  if (regenerate === undefined) {
    if (input.mode === "if_empty") regenerate = false;
    else regenerate = true;
  }
  return { ...input, regenerate };
}

/**
 * 환경 변수에 따라 1차 provider 를 고르고, Gemini 가 예외를 던지면 rule_based_v1 으로 복구한다.
 * Gemini 호출 전 `evaluateSummarizerProviderGate` 를 통과해야 한다.
 * `strategy === "fallback"` 이면 geminiError 가 비어 있지 않다(정상 rule-only 경로는 `geminiError === null` 이고 strategy 는 rule_based_v1).
 */
export async function runSummarizerWithFallback(
  input: SummarizerInput,
): Promise<RunSummarizerWithDetails> {
  const normalized = normalizeSummarizerInput(input);
  const env = resolveSummarizerEnv();
  const primary = pickPrimaryForRun(env);
  const rule = createRuleBasedV1Summarizer();

  const gate = evaluateSummarizerProviderGate({
    resourceKind: normalized.resourceKind,
    content: normalized.content ?? "",
  });

  await logSummarizerSafetyEvaluated({
    actor_id: normalized.userId,
    actor_email: null,
    resource_id: normalized.resourceId,
    resource_kind: normalized.resourceKind,
    allow_provider: gate.allowProvider,
    policy_blocked: gate.policyBlocked,
    policy_reason: gate.policyReason ?? null,
    warning: gate.warning,
    sensitivity_categories: gate.sensitivityCategories,
  });

  const wantGemini = primary === "gemini" && Boolean(env.geminiApiKey);
  const safetySkippedProvider = wantGemini && !gate.allowProvider;

  if (primary === "rule" || !env.geminiApiKey || !gate.allowProvider) {
    const output = await rule.summarize(normalized);
    return {
      output: {
        ...output,
        metadata: {
          ...output.metadata,
          ...(safetySkippedProvider
            ? {
                safety_provider_skipped: true,
                sensitivity_categories: gate.sensitivityCategories,
              }
            : {}),
          resource_kind: normalized.resourceKind,
        },
      },
      geminiError: null,
      attemptedPrimary: primary,
      safetySkippedProvider,
    };
  }

  const gemini = createGeminiSummarizer({
    apiKey: env.geminiApiKey!,
    model: env.geminiModel,
  });

  try {
    const output = await gemini.summarize(normalized);
    return {
      output: {
        ...output,
        metadata: {
          ...output.metadata,
          resource_kind: normalized.resourceKind,
        },
      },
      geminiError: null,
      attemptedPrimary: "gemini",
      safetySkippedProvider: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const base = await rule.summarize(normalized);
    const output: SummarizerOutput = {
      ...base,
      strategy: "fallback",
      metadata: {
        ...base.metadata,
        fallback_from: "gemini",
        fallback_to: "rule_based_v1",
        error_message: msg,
        resource_kind: normalized.resourceKind,
      },
    };
    return {
      output,
      geminiError: msg,
      attemptedPrimary: "gemini",
      safetySkippedProvider: false,
    };
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
  const normalized = normalizeSummarizerInput(input);
  const rule = createRuleBasedV1Summarizer();

  const gate = evaluateSummarizerProviderGate({
    resourceKind: normalized.resourceKind,
    content: normalized.content ?? "",
  });

  await logSummarizerSafetyEvaluated({
    actor_id: normalized.userId,
    actor_email: null,
    resource_id: normalized.resourceId,
    resource_kind: normalized.resourceKind,
    allow_provider: gate.allowProvider,
    policy_blocked: gate.policyBlocked,
    policy_reason: gate.policyReason ?? null,
    warning: gate.warning,
    sensitivity_categories: gate.sensitivityCategories,
  });

  const wantGemini = opts.primary === "gemini" && Boolean(opts.gemini?.apiKey);
  const safetySkippedProvider = wantGemini && !gate.allowProvider;

  if (opts.primary === "rule" || !opts.gemini?.apiKey || !gate.allowProvider) {
    const output = await rule.summarize(normalized);
    return {
      output: {
        ...output,
        metadata: {
          ...output.metadata,
          ...(safetySkippedProvider
            ? {
                safety_provider_skipped: true,
                sensitivity_categories: gate.sensitivityCategories,
              }
            : {}),
          resource_kind: normalized.resourceKind,
        },
      },
      geminiError: null,
      attemptedPrimary: opts.primary,
      safetySkippedProvider,
    };
  }

  const gemini = createGeminiSummarizer(opts.gemini);
  try {
    const output = await gemini.summarize(normalized);
    return {
      output: {
        ...output,
        metadata: {
          ...output.metadata,
          resource_kind: normalized.resourceKind,
        },
      },
      geminiError: null,
      attemptedPrimary: "gemini",
      safetySkippedProvider: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const base = await rule.summarize(normalized);
    return {
      output: {
        ...base,
        strategy: "fallback",
        metadata: {
          ...base.metadata,
          fallback_from: "gemini",
          fallback_to: "rule_based_v1",
          error_message: msg,
          resource_kind: normalized.resourceKind,
        },
      },
      geminiError: msg,
      attemptedPrimary: "gemini",
      safetySkippedProvider: false,
    };
  }
}
