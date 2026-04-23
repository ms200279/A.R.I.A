/**
 * 외부 LLM(Gemini) 호출 전 안전·정책 게이트.
 * - `evaluateMemoCreate` 는 "명시 저장" 맥락 전용이므로 여기서는 재사용하지 않고,
 *   요약 전송에 맞는 판정(민감 패턴, 리소스 종류, 본문 길이)만 수행한다.
 * - document 는 도메인 서비스에서 `prepareDocumentTextForSummarize` 등으로 전처리한 뒤
 *   동일 게이트를 통과한다(민감 패턴·길이 정책).
 * - mail 은 아직 전용 파이프라인이 없어 LLM 호출을 막는다.
 */

import { evaluateSummarizerContentPolicy } from "@/lib/policies/summarize-content";
import type { ResourceKind } from "@/lib/summarizers/types";

import { detectSensitiveContent, type SensitivityCategory } from "./sensitive";

export type SummarizeProviderGateResult = {
  /** 본문 길이 등 하드 정책 위반. */
  policyBlocked: boolean;
  policyReason?: "too_long";
  /** 민감 패턴 등(외부 전송 전 경고). */
  warning: boolean;
  /** Gemini 등 외부 provider 호출 허용. */
  allowProvider: boolean;
  sensitivityCategories: SensitivityCategory[];
};

export function evaluateSummarizerProviderGate(input: {
  resourceKind: ResourceKind;
  content: string;
}): SummarizeProviderGateResult {
  const policy = evaluateSummarizerContentPolicy({
    resourceKind: input.resourceKind,
    content: input.content,
  });

  if (!policy.ok) {
    return {
      policyBlocked: true,
      policyReason: policy.reason,
      warning: false,
      allowProvider: false,
      sensitivityCategories: [],
    };
  }

  const sensitivity = detectSensitiveContent(input.content);
  const warning = sensitivity.length > 0;

  let allowProvider = true;
  if (input.resourceKind === "mail") {
    // TODO(mail): prepareUntrusted·최소 저장 원칙 적용 후 허용.
    allowProvider = false;
  }
  if (warning) {
    allowProvider = false;
  }

  return {
    policyBlocked: false,
    warning,
    allowProvider,
    sensitivityCategories: sensitivity.map((m) => m.category),
  };
}
