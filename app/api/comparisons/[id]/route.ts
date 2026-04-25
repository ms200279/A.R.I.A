import { NextResponse } from "next/server";

import { isComparisonBookmarked } from "@/lib/comparisons/comparison-bookmarks";
import { getComparisonHistoryDetail } from "@/lib/documents/get-comparison-history";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/comparisons/[id]
 * 단일 비교 히스토리 상세(참여 문서·본문 스냅샷).
 */
export async function GET(request: Request, { params }: Params) {
  const { id: comparisonId } = await params;
  const from = new URL(request.url).searchParams.get("from");
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [result, bookmarked] = await Promise.all([
    getComparisonHistoryDetail(
      supabase,
      comparisonId,
      {
        user_id: userData.user.id,
      },
      { context_document_id: from },
    ),
    isComparisonBookmarked(supabase, userData.user.id, comparisonId),
  ]);

  if (!result.ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ...result.data,
    is_bookmarked: bookmarked,
  });
}
