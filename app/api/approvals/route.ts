import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { listPendingActionsForUser } from "@/lib/approvals";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals
 *
 * 현재 사용자의 awaiting_approval 상태 pending_actions 목록.
 * 조회 전용. 실행/거절은 `[id]/confirm`, `[id]/reject` 에서만 일어난다.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await listPendingActionsForUser();
  return NextResponse.json({ items }, { status: 200 });
}
