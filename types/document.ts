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

export type DocumentSummary = {
  id: string;
  document_id: string;
  user_id: string;
  summary_type: "summary";
  content: string;
  source_ranges: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
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
