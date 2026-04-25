import "server-only";

/**
 * Supabase `.select()` 문자열. read-side 전역에서 동일 스냅샷을 유지한다.
 */
export const MEMO_ROW_SELECT =
  "id,user_id,title,content,summary,source_type,project_key,tags,sensitivity_flag,pinned,bookmarked,status,created_at,updated_at" as const;
