/**
 * 문서 도메인 공용 타입.
 * DB 스키마의 snake_case 필드명을 그대로 유지한다.
 */

import type { ComparisonAnchorRole } from "./comparisons";

export type DocumentStatus = "active" | "processing" | "failed" | "archived";

export type DocumentParsingStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "failed"
  | "unsupported_format"
  | "blocked";

export type DocumentPreprocessingStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "failed"
  | "blocked";

export type DocumentSummaryPipelineStatus =
  | "none"
  | "pending"
  | "in_progress"
  | "ready"
  | "failed";

export type Document = {
  id: string;
  user_id: string;
  title: string | null;
  /** 원본 파일명(업로드 시). */
  file_name: string | null;
  /** 정규화된 MIME (text/plain, text/markdown 등). */
  file_type: string | null;
  file_size: number | null;
  sha256_hash: string | null;
  storage_path: string | null;
  /** 레거시·호환: file_type 과 동일하게 유지 가능. */
  mime_type: string | null;
  parsed_text: string | null;
  /** 행 수명주기(처리 중/실패/활성). */
  status: DocumentStatus;
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  parsing_error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentSummaryType = "summary" | "comparison" | "analysis";

export type DocumentSummary = {
  id: string;
  document_id: string;
  user_id: string;
  summary_type: DocumentSummaryType;
  content: string;
  source_ranges: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/** POST /api/documents/compare 응답(저장 content 는 JSON 문자열로 직렬화 가능). */
export type DocumentCompareResultPayload = {
  compared_document_ids: string[];
  summary_of_differences: string;
  summary_of_common_points: string;
  notable_gaps_or_conflicts: string;
  source_ranges?: Record<string, unknown> | null;
};

/** POST /api/documents/[id]/analyze 응답. */
export type DocumentAnalyzeResultPayload = {
  document_id: string;
  analysis: string;
  key_points?: string[];
  potential_risks?: string[];
  follow_up_questions?: string[];
  source_ranges?: Record<string, unknown> | null;
};

export type DocumentChunk = {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  page_number: number | null;
  section_label: string | null;
  created_at: string;
};

/** GET /api/documents/[id] 등에 내려주는 최신 요약 조각(원문·source_ranges 제외). */
export type DocumentLatestSummaryPublic = {
  id: string;
  content: string;
  created_at: string;
  summary_type: DocumentSummaryType;
};

/**
 * read-side `latest_comparison` (정책 A: 이 문서가 앵커/피어로 참여한 비교 히스토리∪
 * 레거시 `document_summaries` 기준, `created_at`이 가장 늦은 1건).
 * 상세/목록/assistant가 동일 helper에서 채운다. `id`는 공개 id(`summary_id` 우선, 없으면 history id / 레거시 행 id).
 */
export type DocumentLatestComparisonPublic = {
  id: string;
  content: string;
  created_at: string;
  summary_type: "comparison";
  /** `comparison_histories.id`. 레거시-only 비교면 null. */
  comparison_id: string | null;
  current_document_anchor_role: ComparisonAnchorRole | null;
  /** `document_id`가 `primary_document_id`와 같을 때 true; 레거시(행이 이 문서에만 매칭)면 true. */
  is_primary_context: boolean;
  related_documents_preview: string;
  content_preview: string;
};

/** GET /api/documents/[id]/summaries 및 상세·목록 확장용 공통 조각(청크 본문 없음). */
export type DocumentSummaryReadItem = {
  id: string;
  summary_type: DocumentSummaryType;
  content: string;
  created_at: string;
  source_ranges?: Record<string, unknown> | null;
};

/** 타입별 최신 1건(존재하는 키만). */
export type DocumentSummariesLatestBundle = {
  summary?: DocumentSummaryReadItem;
  comparison?: DocumentSummaryReadItem;
  analysis?: DocumentSummaryReadItem;
};

/** summaries read API 본문. */
export type DocumentSummariesListPayload = {
  document_id: string;
  items: DocumentSummaryReadItem[];
  latest?: DocumentSummariesLatestBundle;
};

/**
 * 문서 상세 API 본문. `parsed_text`·청크 content 는 비신뢰 원문이므로 기본 응답에 넣지 않는다.
 */
/** GET /api/documents 목록 항목(상세 DTO의 축약·일관 필드). */
export type DocumentListItemPayload = {
  id: string;
  title: string | null;
  file_name: string | null;
  file_type: string | null;
  /** 목록·폴링 UI 에서 행 수명·실패 판정 보조. */
  status: DocumentStatus;
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  parsing_error_code: string | null;
  /** 동일 파일 중복 안내(선택). 원문 아님. */
  sha256_hash: string | null;
  created_at: string;
  updated_at: string;
  latest_summary_exists: boolean;
  /** 요약이 있을 때만. 짧은 미리보기(원문 아님). */
  latest_summary_preview: string | null;
  /**
   * 정책 A: 이 문서가 참여한 최신 비교의 존재(히스토리·레거시).
   * `latest_comparison_preview`·`content_preview`와 항상 동기.
   */
  latest_comparison_exists: boolean;
  latest_comparison_preview: string | null;
  /**
   * 히스토리 링크가 없는 레거시-only 비교·role 누락 시 null.
   * 목록 배지/필터용; 상세 `DocumentLatestComparisonPublic`과 동일 기준.
   */
  latest_comparison_anchor_role: ComparisonAnchorRole | null;
  latest_analysis_exists: boolean;
  latest_analysis_preview: string | null;
  /** 상세 API `can_summarize` 와 동일 판정(목록은 `parsed_text` 미로드 → 청크 수 기준). */
  can_summarize: boolean;
  can_compare: boolean;
};

export type DocumentDetailPayload = {
  id: string;
  title: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  /** 현재는 업로드 파이프라인 기준. storage_path 가 있으면 `upload`, 없으면 `pending`. */
  source: "upload" | "pending";
  /** DB `documents.status`. 폴링 종료·실패 판정에 사용. */
  status: DocumentStatus;
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  parsing_error_code: string | null;
  sha256_hash: string | null;
  created_at: string;
  updated_at: string;
  latest_summary: DocumentLatestSummaryPublic | null;
  latest_comparison: DocumentLatestComparisonPublic | null;
  latest_analysis: DocumentLatestSummaryPublic | null;
  chunk_count: number;
  can_summarize: boolean;
  /**
   * 비교 API 입력 구성 가능 여부.
   * @see evaluateDocumentCanCompareEligible — `status=active`, 파싱·전처리 `complete`, 본문(청크 또는 parsed_text) 존재.
   */
  can_compare: boolean;
};

export type {
  AssistantComparisonDetailAttachment,
  ComparisonAnchorRole,
  ComparisonDetailDocumentsFilterMode,
  ComparisonDetailDocumentsSortMode,
  ComparisonHistoryListRoleFilter,
  ComparisonDetailPayload,
  ComparisonHistoryCurrentContext,
  ComparisonHistoryDetailApiResponse,
  ComparisonHistoryDetailPayload,
  ComparisonHistoryListApiResponse,
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListPageInfo,
  ComparisonHistoryListResult,
  ComparisonHistoryListSort,
} from "./comparisons";

/** POST /api/documents/upload 성공(201). */
export type DocumentUploadSuccessResponse = {
  document: Document;
};

/** POST /api/documents/upload 실패 본문. */
export type DocumentUploadErrorResponse = {
  error: string;
  document_id?: string | null;
};
