import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SaveMemoPendingOutcome } from "@/types/pending-action";

/**
 * save_memo pending_actions 중 최근 종료된 건(executed / rejected / blocked).
 * UI 에서 승인 대기와 구분해 "처리됨" 흐름을 보여 줄 때 사용한다.
 */

export async function listRecentSaveMemoOutcomes(
  limit = 12,
): Promise<SaveMemoPendingOutcome[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pending_actions")
    .select(
      "id,status,payload,blocked_reason,result,created_at,updated_at",
    )
    .eq("action_type", "save_memo")
    .in("status", ["executed", "rejected", "blocked"])
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error || !data) return [];
  return data as SaveMemoPendingOutcome[];
}
