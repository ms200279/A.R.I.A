import { NextResponse } from "next/server";

import { getDocumentDetail } from "@/lib/documents/get-document";
import { logDocumentReadStarted } from "@/lib/logging/audit-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]
 *
 * 문서 메타 + 최신 요약(`summary_type=summary`) + chunk 수·플래그.
 * `parsed_text`·청크 본문은 내려주지 않는다.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await logDocumentReadStarted({
    actor_id: userData.user.id,
    actor_email: userData.user.email ?? null,
    document_id: id,
    source: "api",
  });

  const result = await getDocumentDetail(supabase, id, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
    source: "api",
  });

  if (!result.ok) {
    const status = result.reason === "forbidden" ? 403 : 404;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ document: result.document });
}
