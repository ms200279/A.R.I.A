import "server-only";

export const DOCUMENT_ROW_SELECT =
  "id,user_id,title,storage_path,mime_type,parsed_text,status,created_at,updated_at" as const;

export const DOCUMENT_SUMMARY_ROW_SELECT =
  "id,document_id,user_id,summary_type,content,source_ranges,created_at,updated_at" as const;
