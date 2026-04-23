import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SaveMemoPending } from "@/types/pending-action";

/**
 * 현재 사용자의 awaiting_approval 상태 save_memo pending action 목록.
 * RLS(pending_actions_select_own) 하에서 본인 행만 반환된다.
 */
export async function listPendingSaveMemos(): Promise<SaveMemoPending[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pending_actions")
    .select(
      "id,user_id,action_type,target_type,status,payload,sensitivity_flag,blocked_reason,result,created_at,updated_at",
    )
    .eq("action_type", "save_memo")
    .eq("status", "awaiting_approval")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as SaveMemoPending[];
}
