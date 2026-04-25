import { NextResponse } from "next/server";

import {
  listComparisonHistoriesPage,
  MAX_DOCUMENT_COMPARISONS_LIMIT,
  DEFAULT_DOCUMENT_COMPARISONS_LIMIT,
} from "@/lib/documents/list-document-comparisons";
import { parseComparisonHistoryListRoleFilter } from "@/lib/documents/comparison-history-list-query-params";
import {
  parseComparisonHistoryLimitParam,
  parseComparisonHistoryListSort,
} from "@/lib/documents/comparison-list-cursor";
import {
  logComparisonHistoryListRead,
  logComparisonHistoryListReadFailed,
} from "@/lib/logging/audit-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]/comparisons
 * Query: `limit`(기본 20, 상한 50), `cursor`(base64url 키셋), `sort`=`created_at_desc`|`created_at_asc`(기본 desc).
 */
export async function GET(request: Request, { params }: Params) {
  const { id: documentId } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;
  const email = userData.user.email ?? null;

  const url = new URL(request.url);
  const limitParsed = parseComparisonHistoryLimitParam(
    url.searchParams.get("limit"),
    DEFAULT_DOCUMENT_COMPARISONS_LIMIT,
    MAX_DOCUMENT_COMPARISONS_LIMIT,
  );
  if (limitParsed === "invalid") {
    return NextResponse.json(
      { error: "invalid_limit", max: MAX_DOCUMENT_COMPARISONS_LIMIT, min: 1 },
      { status: 400 },
    );
  }

  const sort = parseComparisonHistoryListSort(url.searchParams.get("sort"));
  const roleFilter = parseComparisonHistoryListRoleFilter(url.searchParams.get("role_filter"));
  const cursorRaw = url.searchParams.get("cursor");

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (docErr || !doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const result = await listComparisonHistoriesPage(supabase, {
      userId,
      contextDocumentId: documentId,
      limit: limitParsed,
      cursor: cursorRaw,
      sort,
      roleFilter,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
    }

    void logComparisonHistoryListRead({
      actor_id: userId,
      actor_email: email,
      context: "document",
      context_document_id: documentId,
      result_count: result.data.items.length,
      has_more: result.data.pageInfo.hasMore,
      sort,
      role_filter: result.data.roleFilter,
    }).catch(() => {});

    return NextResponse.json({
      document_id: documentId,
      items: result.data.items,
      pageInfo: result.data.pageInfo,
      sort: result.data.sort,
      role_filter: result.data.roleFilter,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    void logComparisonHistoryListReadFailed({
      actor_id: userId,
      actor_email: email,
      error_code: "comparison_list_query_failed",
      error_message: message,
    }).catch(() => {});
    return NextResponse.json({ error: "comparison_list_failed" }, { status: 500 });
  }
}
