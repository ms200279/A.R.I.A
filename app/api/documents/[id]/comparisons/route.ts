import { NextResponse } from "next/server";

import {
  listDocumentComparisons,
  MAX_DOCUMENT_COMPARISONS_LIMIT,
} from "@/lib/documents/list-document-comparisons";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]/comparisons
 * Query: `limit` (기본 20, 상한 50) — 이 문서가 참여한 비교 히스토리 최신순.
 */
export async function GET(request: Request, { params }: Params) {
  const { id: documentId } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  let limit: number | undefined;
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > MAX_DOCUMENT_COMPARISONS_LIMIT) {
      return NextResponse.json(
        { error: "invalid_limit", max: MAX_DOCUMENT_COMPARISONS_LIMIT, min: 1 },
        { status: 400 },
      );
    }
    limit = n;
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (docErr || !doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const items = await listDocumentComparisons(supabase, documentId, {
    user_id: userData.user.id,
  }, { limit });

  return NextResponse.json({ document_id: documentId, items });
}
