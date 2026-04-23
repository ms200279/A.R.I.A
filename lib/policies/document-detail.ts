/**
 * 문서 상세·목록·UI/assistant 용 플래그. 원문/청크 본문은 노출하지 않고 판별만 한다.
 */

import type {
  DocumentParsingStatus,
  DocumentPreprocessingStatus,
  DocumentStatus,
  DocumentSummaryPipelineStatus,
} from "@/types/document";

export function evaluateDocumentCanSummarize(args: {
  status: DocumentStatus;
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  chunkCount: number;
  hasParsedText: boolean;
}): boolean {
  if (args.summary_status === "in_progress") {
    return false;
  }
  const hasText = args.chunkCount > 0 || args.hasParsedText;
  if (!hasText) {
    return false;
  }
  if (args.status !== "active") {
    return false;
  }
  if (args.parsing_status !== "complete" || args.preprocessing_status !== "complete") {
    return false;
  }
  return true;
}

/**
 * 다문서 비교 후보 (`POST /api/documents/compare` 와 DTO `can_compare` 공통 기준).
 *
 * - 문서 `status` 가 `active`
 * - `parsing_status`·`preprocessing_status` 가 각각 `complete` (스키마상 “준비 완료”; 별도 `ready` 값은 없음)
 * - 청크 1개 이상 또는 `parsed_text` 존재로 비교용 텍스트를 구성할 수 있을 것
 * - `summary_status === in_progress` 이면 false
 *
 * 비교 **결과** 행(`summary_type=comparison`) 유무와 무관하다.
 */
export function evaluateDocumentCanCompareEligible(args: {
  status: DocumentStatus;
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  chunkCount: number;
  hasParsedText: boolean;
}): boolean {
  return evaluateDocumentCanSummarize({
    status: args.status,
    parsing_status: args.parsing_status,
    preprocessing_status: args.preprocessing_status,
    summary_status: args.summary_status,
    chunkCount: args.chunkCount,
    hasParsedText: args.hasParsedText,
  });
}

/** 목록 등 `parsed_text` 없이 청크 수만 알 때: 본문 존재를 청크로만 가정. */
export function evaluateDocumentCanCompareEligibleForListItem(args: {
  status: DocumentStatus;
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  chunkCount: number;
}): boolean {
  return evaluateDocumentCanCompareEligible({
    ...args,
    hasParsedText: false,
  });
}
