/**
 * 문서 비교·분석 LLM 입력 상한(비신뢰 원문 합산).
 * summarize 상한(DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS)과 별도로 둔다.
 */

export const DOCUMENT_COMPARE_COMBINED_INPUT_MAX_CHARS = 280_000;
export const DOCUMENT_ANALYZE_INPUT_MAX_CHARS = 300_000;

/** 문서당 비교 시 할당 최소 바닥(너무 잘려 맥락 상실 방지용 힌트). */
export const DOCUMENT_COMPARE_MIN_PER_DOC_CHARS = 2_000;
