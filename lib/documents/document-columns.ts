import "server-only";

export const DOCUMENT_ROW_SELECT =
  "id,user_id,title,file_name,file_type,file_size,sha256_hash,storage_path,mime_type,parsed_text,status,parsing_status,preprocessing_status,summary_status,parsing_error_code,created_at,updated_at" as const;

export const DOCUMENT_SUMMARY_ROW_SELECT =
  "id,document_id,user_id,summary_type,content,source_ranges,created_at,updated_at" as const;
