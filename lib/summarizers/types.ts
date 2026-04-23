/**
 * 공통 요약 계약. 메모·문서·메일이 동일 SummarizerAdapter 를 공유한다.
 * 문서 저장(`document_chunks` / `document_summaries`)·메일 비신뢰 원문은 후속 단계에서 연결.
 */

export type ResourceKind = "memo" | "document" | "mail";

export type SummarizerInput = {
  userId: string;
  resourceKind: ResourceKind;
  resourceId: string;
  title: string | null;
  content: string;
  existingSummary: string | null;
  /** true 이면 기존 요약을 보강 맥락으로 쓸 수 있다(프롬프트 노출 최소화). */
  regenerate?: boolean;
  metadata?: Record<string, unknown>;
  /**
   * 메모 API `mode` 와의 호환. 어댑터는 `regenerate` 를 우선한다.
   * @deprecated 신규 코드는 `regenerate` 만 사용.
   */
  mode?: "regenerate" | "if_empty";
};

/**
 * - `strategy`: 실제에 가까운 분류. `fallback` = Gemini 실패 후 rule 기반.
 * - `provider`: 최종 응답을 만든 쪽(gemini 또는 rule).
 */
export type SummarizerOutput = {
  summary: string;
  provider: "gemini" | "rule";
  model: string | null;
  strategy: "rule_based_v1" | "gemini" | "fallback";
  chunked: boolean;
  chunkCount?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  /** 감사/디버그용(원문/전체 키 금지). */
  metadata?: Record<string, unknown>;
};

export type SummarizerAdapter = {
  readonly id: string;
  summarize(input: SummarizerInput): Promise<SummarizerOutput>;
};

/** @deprecated `SummarizerAdapter` 사용 */
export type Summarizer = SummarizerAdapter;
