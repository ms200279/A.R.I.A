import { NextResponse } from "next/server";

import {
  addComparisonBookmark,
  removeComparisonBookmark,
} from "@/lib/comparisons/comparison-bookmarks";
import {
  logComparisonBookmarkAdded,
  logComparisonBookmarkFailed,
  logComparisonBookmarkRemoved,
} from "@/lib/logging/audit-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/comparisons/[id]/bookmark — 내부 북마크 추가(중복 시 idempotent 성공).
 * DELETE /api/comparisons/[id]/bookmark — 북마크 제거(없으면 idempotent).
 */
export async function POST(_request: Request, { params }: Params) {
  const { id: comparisonId } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;
  const email = userData.user.email ?? null;

  const result = await addComparisonBookmark(supabase, userId, comparisonId);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    void logComparisonBookmarkFailed({
      actor_id: userId,
      actor_email: email,
      comparison_id: comparisonId,
      error_code: "bookmark_add_failed",
      error_message: result.message ?? null,
    }).catch(() => {});
    return NextResponse.json({ error: "bookmark_failed" }, { status: 500 });
  }

  void logComparisonBookmarkAdded({
    actor_id: userId,
    actor_email: email,
    comparison_id: comparisonId,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id: comparisonId } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;
  const email = userData.user.email ?? null;

  const result = await removeComparisonBookmark(supabase, userId, comparisonId);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    void logComparisonBookmarkFailed({
      actor_id: userId,
      actor_email: email,
      comparison_id: comparisonId,
      error_code: "bookmark_remove_failed",
      error_message: result.message ?? null,
    }).catch(() => {});
    return NextResponse.json({ error: "bookmark_failed" }, { status: 500 });
  }

  void logComparisonBookmarkRemoved({
    actor_id: userId,
    actor_email: email,
    comparison_id: comparisonId,
  }).catch(() => {});

  return new NextResponse(null, { status: 204 });
}
