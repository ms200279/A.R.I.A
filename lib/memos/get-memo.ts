import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  logMemoDetailRead,
  logMemoReadMissing,
} from "@/lib/logging/audit-log";
import type { Memo } from "@/types/memo";

import { MEMO_ROW_SELECT } from "./memo-columns";

export type GetMemoOptions = {
  /**
   * 성공/실패(빈 값)에 대한 감사 로그. API/RSC/assistant에서 선택.
   */
  audit?: {
    actor_id: string;
    actor_email?: string | null;
    source: "api" | "rsc" | "assistant";
    /** `true` 이면 memo가 없을 때 `memo.read.missing` 기록 */
    log_missing?: boolean;
  };
};

/**
 * 단일 메모 조회. RLS(memos_select_own) 하에서 본인 소유 active 행만 읽힌다.
 * 다른 사용자 id를 넣어도 `null` (권한 없음과 동일한 표면).
 */
export async function getMemo(
  id: string,
  options: GetMemoOptions = {},
): Promise<Memo | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("memos")
    .select(MEMO_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (!data) {
    if (options.audit?.log_missing) {
      await logMemoReadMissing({
        actor_id: options.audit.actor_id,
        actor_email: options.audit.actor_email ?? null,
        source: options.audit.source,
        memo_id: id,
      });
    }
    return null;
  }

  if (options.audit) {
    await logMemoDetailRead({
      actor_id: options.audit.actor_id,
      actor_email: options.audit.actor_email ?? null,
      source: options.audit.source,
      memo_id: (data as Memo).id,
    });
  }

  return data as Memo;
}
