import "server-only";

export const DOCUMENT_ROW_SELECT =
  "id,user_id,title,file_name,file_type,file_size,sha256_hash,storage_path,mime_type,parsed_text,status,parsing_status,preprocessing_status,summary_status,parsing_error_code,created_at,updated_at" as const;

/** 목록 조회: 원문 컬럼 제외(비신뢰 대용량 텍스트 메모리 방지). */
export const DOCUMENT_LIST_ROW_SELECT =
  "id,user_id,title,file_name,file_type,file_size,status,parsing_status,preprocessing_status,summary_status,created_at,updated_at" as const;

export const DOCUMENT_SUMMARY_ROW_SELECT =
  "id,document_id,user_id,summary_type,content,source_ranges,created_at,updated_at" as const;

/** GET 상세 등: 요약 본문 노출용(메타만, source_ranges 생략 가능 시 이 목록 사용). */
export const DOCUMENT_SUMMARY_PUBLIC_SELECT =
  "id,content,created_at,summary_type" as const;
