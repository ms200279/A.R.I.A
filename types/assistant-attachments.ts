/**
 * Assistant 말풍선 인라인 카드. 원문·청크 본문은 포함하지 않는다.
 * 비교·분석은 read-side DTO 를 재사용한다 (`types/comparisons.ts` 등).
 */

import type {
  AssistantComparisonDetailAttachment,
  ComparisonHistoryListItemPayload,
} from "./comparisons";

export type {
  AssistantComparisonDetailAttachment,
  ComparisonHistoryDetailPayload,
} from "./comparisons";

/**
 * `get_document_detail` 이후 `listDocumentComparisons` 로 보강되면 이 kind 가 된다.
 * `ComparisonHistoryListItemPayload` 는 문서 상세 히스토리 목록과 동일.
 */
export type AssistantComparisonHistoryItemAttachment = {
  kind: "comparison_history_item";
  context_document_id: string;
  item: ComparisonHistoryListItemPayload;
};

/** @deprecated — 오래된 응답/클라 캐시. `comparison_history_item` + DTO 를 우선한다. */
export type DocumentLatestComparisonCardAttachment = {
  kind: "document_latest_comparison_card";
  documentId: string;
  documentTitle: string | null;
  /** `document_summaries` 행 id (비교 결과 저장). */
  comparisonSummaryId: string;
  contentPreview: string;
  createdAt: string;
  /** 있으면 비교 상세 라우트로 연결. */
  comparisonHistoryId?: string | null;
  relatedDocumentIds?: string[];
};

export type DocumentLatestAnalysisCardAttachment = {
  kind: "document_latest_analysis_card";
  documentId: string;
  documentTitle: string | null;
  analysisSummaryId: string;
  contentPreview: string;
  createdAt: string;
  keyPoints?: string[];
};

export type AssistantMessageAttachment =
  | AssistantComparisonHistoryItemAttachment
  | AssistantComparisonDetailAttachment
  | DocumentLatestComparisonCardAttachment
  | DocumentLatestAnalysisCardAttachment;
