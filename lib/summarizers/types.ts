/**
 * 문서/메일 등으로 확장할 수 있게 resource 를 추상 id 로 둔다. 메모는 `memoId === resourceId`.
 */
export type SummarizerInput = {
  userId: string;
  resourceId: string;
  title: string | null;
  content: string;
  /** 원본 요약(재요약 맥락용; 프롬프트에는 과도한 노출을 피해 최소한만). */
  existingSummary: string | null;
  /**
   * 호출 측 정책 힌트(선택). 실제 if_empty 스킵은 `lib/memos/summarize-memo`에서 처리.
   * 어댑터는 regenerate 기준 본문만 요약에 사용한다.
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
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  /** 감사/디버그용(원문/전체 키 금지). */
  metadata?: Record<string, unknown>;
};

/**
 * 제네릭 요약기. memos/문서/메일이 동일 계약을 공유한다.
 */
export type Summarizer = {
  readonly id: string;
  summarize(input: SummarizerInput): Promise<SummarizerOutput>;
};
