/**
 * 문서 도메인 공용 타입.
 * DB 스키마의 snake_case 필드명을 그대로 유지한다.
 */

export type DocumentStatus = "active" | "processing" | "failed" | "archived";

export type Document = {
  id: string;
  user_id: string;
  title: string | null;
  storage_path: string | null;
  mime_type: string | null;
  parsed_text: string | null;
  status: DocumentStatus;
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
