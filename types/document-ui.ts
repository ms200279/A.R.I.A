/**
 * 문서 대시보드 UI 전용 타입. API DTO(`types/document`)와 정렬해 두고 카드 props 에 재사용한다.
 */

import type {
  DocumentDetailPayload,
  DocumentLatestComparisonPublic,
  DocumentLatestSummaryPublic,
} from "./document";

export type { DocumentDetailPayload, DocumentLatestComparisonPublic, DocumentLatestSummaryPublic };

/** 상세 화면 요약/분석 카드 — API `DocumentLatestSummaryPublic` 와 동일. */
export type DocumentDetailLatestBlock = DocumentLatestSummaryPublic;

/** 비교 카드 전용 — `DocumentLatestComparisonPublic`(정책 A DTO). */
export type DocumentDetailComparisonBlock = DocumentLatestComparisonPublic;

export type DocumentMetaPanelModel = Pick<
  DocumentDetailPayload,
  | "title"
  | "file_name"
  | "file_type"
  | "file_size"
  | "source"
  | "parsing_status"
  | "preprocessing_status"
  | "summary_status"
  | "created_at"
  | "updated_at"
  | "can_compare"
  | "can_summarize"
  | "chunk_count"
>;
