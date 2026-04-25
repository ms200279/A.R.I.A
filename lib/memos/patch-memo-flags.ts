import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export type PatchMemoReadSideContext = {
  user_id: string;
};

/**
 * RLS 가 memos UPDATE 를 막기 때문에 `service_role` + 소유자 검증으로만 갱신한다.
 * read-side 전용( 핀/북마크), 승인/pending_actions 와 분리.
 */
export async function patchMemoReadSideFlags(
  memoId: string,
  ctx: PatchMemoReadSideContext,
  patch: { pinned?: boolean; bookmarked?: boolean },
): Promise<{ ok: true } | { ok: false; error: "not_found" | "no_changes" }> {
  const hasPin = patch.pinned !== undefined;
  const hasMark = patch.bookmarked !== undefined;
  if (!hasPin && !hasMark) {
    return { ok: false, error: "no_changes" };
  }

  const service = createServiceClient();
  const { data: row, error: selErr } = await service
    .from("memos")
    .select("id")
    .eq("id", memoId)
    .eq("user_id", ctx.user_id)
    .eq("status", "active")
    .maybeSingle();

  if (selErr || !row) {
    return { ok: false, error: "not_found" };
  }

  const updates: { pinned?: boolean; bookmarked?: boolean } = {};
  if (hasPin) updates.pinned = patch.pinned;
  if (hasMark) updates.bookmarked = patch.bookmarked;

  const { error: upErr } = await service
    .from("memos")
    .update(updates)
    .eq("id", memoId)
    .eq("user_id", ctx.user_id);

  if (upErr) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true };
}
