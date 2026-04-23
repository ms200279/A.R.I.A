import { NextResponse } from "next/server";

import { analyzeDocument } from "@/lib/documents/analyze-document";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/documents/[id]/analyze
 * 본문 JSON 불필요. 단일 문서 해석·리스크·후속 질문.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await analyzeDocument(id, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  });

  if (result.status === "error") {
    const statusMap: Record<string, number> = {
      document_not_found: 404,
      forbidden: 403,
      content_policy_violation: 400,
      document_chunks_load_failed: 500,
      document_empty: 422,
      document_not_ready: 409,
      document_not_summarizable: 422,
    };
    const status = statusMap[result.reason] ?? 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    ...result.result,
    persisted: result.persisted,
    summary_id: result.summary?.id ?? null,
  });
}
