import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SaveMemoPending } from "@/types/pending-action";

/**
 * 현재 세션 사용자의 awaiting_approval pending_actions 목록.
 *
 * RLS(pending_actions_select_own) 가 걸린 server client 로 조회하므로
 * user_id 를 명시할 필요가 없다. action_type 확장 시 여기를 union 반환으로 넓힌다.
 */
export async function listPendingActionsForUser(): Promise<SaveMemoPending[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pending_actions")
    .select(
      "id,user_id,action_type,target_type,status,payload,sensitivity_flag,blocked_reason,result,created_at,updated_at",
    )
    .eq("status", "awaiting_approval")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as SaveMemoPending[];
}
