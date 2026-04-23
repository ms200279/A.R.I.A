import { NextResponse } from "next/server";
import { z } from "zod";

import { compareDocuments } from "@/lib/documents/compare-documents";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  document_ids: z.array(z.string().uuid()).min(2).max(8),
});

/**
 * POST /api/documents/compare
 * body: `{ "document_ids": ["uuid", "uuid", ...] }` (순서 유지, 첫 id 가 저장 앵커)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await compareDocuments(parsed.data.document_ids, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  });

  if (result.status === "error") {
    const statusMap: Record<string, number> = {
      compare_requires_two_documents: 400,
      compare_too_many_documents: 400,
      forbidden_or_missing_document: 404,
      content_policy_violation: 400,
      document_not_found: 404,
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
    comparison_history_id: result.comparison_history_id,
  });
}
