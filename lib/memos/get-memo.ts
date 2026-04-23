import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Memo } from "@/types/memo";

export async function getMemo(id: string): Promise<Memo | null> {
  const supabase = await createClient();

  // RLS(memos_select_own) 하에서 본인 소유 행만 읽힌다.
  const { data, error } = await supabase
    .from("memos")
    .select(
      "id,user_id,title,content,summary,source_type,project_key,sensitivity_flag,status,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return null;
  return (data as Memo | null) ?? null;
}
