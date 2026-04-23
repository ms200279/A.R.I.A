/**
 * 문서 도메인 공용 타입.
 * DB 스키마의 snake_case 필드명을 그대로 유지한다.
 */

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
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  created_at: string;
  updated_at: string;
  latest_summary_exists: boolean;
  /** 요약이 있을 때만. 짧은 미리보기(원문 아님). */
  latest_summary_preview: string | null;
  /** 이 문서 id가 비교 결과 저장 앵커인 경우 등. 짧은 미리보기. */
  latest_comparison_exists: boolean;
  latest_comparison_preview: string | null;
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
  parsing_status: DocumentParsingStatus | null;
  preprocessing_status: DocumentPreprocessingStatus | null;
  summary_status: DocumentSummaryPipelineStatus | null;
  created_at: string;
  updated_at: string;
  latest_summary: DocumentLatestSummaryPublic | null;
  /** `document_summaries.summary_type=comparison` 이 이 문서 id에 매달린 최신 행(비교 앵커 문서에만 존재할 수 있음). */
  latest_comparison: DocumentLatestSummaryPublic | null;
  latest_analysis: DocumentLatestSummaryPublic | null;
  chunk_count: number;
  can_summarize: boolean;
  /**
   * 비교 API 입력 구성 가능 여부.
   * @see evaluateDocumentCanCompareEligible — `status=active`, 파싱·전처리 `complete`, 본문(청크 또는 parsed_text) 존재.
   */
  can_compare: boolean;
};

/** 비교 히스토리 앵커 역할. */
export type ComparisonAnchorRole = "primary" | "peer";

/** GET /api/comparisons/[id] 본문. */
export type ComparisonHistoryDetailPayload = {
  comparison_id: string;
  summary_id: string | null;
  primary_document_id: string;
  created_at: string;
  updated_at: string;
  content: string;
  source_ranges: Record<string, unknown> | null;
  documents: Array<{
    id: string;
    title: string | null;
    file_name: string | null;
    anchor_role: ComparisonAnchorRole;
    sort_order: number;
  }>;
};

/** GET /api/documents/[id]/comparisons 목록 항목. */
export type ComparisonHistoryListItemPayload = {
  comparison_id: string;
  summary_id: string | null;
  primary_document_id: string;
  created_at: string;
  document_count: number;
  other_documents_preview: string;
  content_preview: string;
};
