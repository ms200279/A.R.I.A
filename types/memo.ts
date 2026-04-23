/**
 * 메모 도메인 공용 타입.
 * DB 스키마의 snake_case 필드명을 그대로 유지한다.
 */

export type MemoSourceType = "quick_capture" | "chat" | "import";
export type MemoStatus = "active" | "archived";

export type Memo = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  summary: string | null;
  source_type: MemoSourceType;
  project_key: string | null;
  sensitivity_flag: boolean;
  status: MemoStatus;
  created_at: string;
  updated_at: string;
};
