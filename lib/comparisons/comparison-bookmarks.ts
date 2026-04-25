import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * comparison_histories 는 RLS+user_id 로 스코프. 북마크는 본인 행만.
 */

export async function isComparisonBookmarked(
  supabase: SupabaseClient,
  userId: string,
  comparisonId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("comparison_bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("comparison_id", comparisonId)
    .maybeSingle();

  if (error) {
    return false;
  }
  return Boolean(data);
}

async function userOwnsComparison(
  supabase: SupabaseClient,
  userId: string,
  comparisonId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("comparison_histories")
    .select("id")
    .eq("id", comparisonId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return true;
}

export type ComparisonBookmarkWriteResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "conflict" | "error"; message?: string };

/**
 * 북마크 추가. 이미 있으면 duplicate unique → ok: true (idempotent).
 */
export async function addComparisonBookmark(
  supabase: SupabaseClient,
  userId: string,
  comparisonId: string,
): Promise<ComparisonBookmarkWriteResult> {
  const owns = await userOwnsComparison(supabase, userId, comparisonId);
  if (!owns) {
    return { ok: false, reason: "not_found" };
  }

  const { error } = await supabase.from("comparison_bookmarks").insert({
    user_id: userId,
    comparison_id: comparisonId,
    label: null,
  });

  if (!error) {
    return { ok: true };
  }

  // Postgres unique_violation
  if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
    return { ok: true };
  }

  return { ok: false, reason: "error", message: error.message };
}

/**
 * 북마크 제거. 없으면 idempotent success.
 */
export async function removeComparisonBookmark(
  supabase: SupabaseClient,
  userId: string,
  comparisonId: string,
): Promise<ComparisonBookmarkWriteResult> {
  const owns = await userOwnsComparison(supabase, userId, comparisonId);
  if (!owns) {
    return { ok: false, reason: "not_found" };
  }

  const { error } = await supabase
    .from("comparison_bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("comparison_id", comparisonId);

  if (error) {
    return { ok: false, reason: "error", message: error.message };
  }
  return { ok: true };
}
