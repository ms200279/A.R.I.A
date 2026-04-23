/**
 * lib/safety
 *
 * 비신뢰(untrusted) 입력의 전처리 / 프롬프트 인젝션 완화 파이프라인.
 * 상세 정책은 docs/data-flow.md, docs/product-policy 참조.
 *
 * 공개 API (초안, 이번 단계에서는 시그니처만 제공):
 *   prepareUntrusted(input, options) -> SafeChunks
 *   wrapAsData(chunks) -> string   // LLM 프롬프트의 "data" 슬롯 래퍼
 *
 * 구현 금지 사항:
 *  - 원문을 그대로 반환하는 경로를 만들지 않는다.
 *  - 외부 입력 안의 지시처럼 보이는 문장을 LLM "instruction" 슬롯에 그대로 싣는 경로를 만들지 않는다.
 */

export type UntrustedSource = "document" | "mail" | "web_search" | "web_page" | "calendar_text";

export type SafeChunk = {
  source: UntrustedSource;
  text: string;
  /** 원본의 어디서 왔는지 추적하기 위한 포인터 (예: document_id#section_3) */
  origin: string;
};

export type SafeChunks = {
  chunks: SafeChunk[];
  /** 전처리로 제거/격리된 항목의 수 (감사용) */
  droppedCount: number;
};

export type PrepareOptions = {
  maxChars?: number;
  maxChunks?: number;
};

export async function prepareUntrusted(
  _input: { source: UntrustedSource; origin: string; raw: string },
  _options?: PrepareOptions,
): Promise<SafeChunks> {
  // TODO: 크기 제한, 섹션 분할, 지시성 문장 격리, (선택) PII 태깅 구현
  throw new Error("not_implemented: lib/safety.prepareUntrusted");
}

export function wrapAsData(_chunks: SafeChunks): string {
  // TODO: LLM 에 데이터로만 해석하도록 강제하는 래퍼 포맷 반환
  throw new Error("not_implemented: lib/safety.wrapAsData");
}

export {
  detectSensitiveContent,
  hasSensitiveContent,
  type SensitivityCategory,
  type SensitivityMatch,
} from "./sensitive";

export {
  evaluateSummarizerProviderGate,
  type SummarizeProviderGateResult,
} from "./summarize-provider-gate";

export {
  prepareDocumentTextForSummarize,
  prepareDocumentChunkTextForSummarize,
} from "./document-text";
