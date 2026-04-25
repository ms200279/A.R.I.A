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

/**
 * GET /api/comparisons
 * Query: `documentId`(선택 — 있으면 해당 문서 맥락), `limit`, `cursor`, `sort`.
 * 전체 비교 이력(사용자 스코프) 또는 문서 기준 필터.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;
  const email = userData.user.email ?? null;

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId")?.trim() || null;

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

  if (documentId) {
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (docErr || !doc) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  try {
    const effectiveRoleFilter = documentId ? roleFilter : "all";

    const result = await listComparisonHistoriesPage(supabase, {
      userId,
      contextDocumentId: documentId,
      limit: limitParsed,
      cursor: cursorRaw,
      sort,
      roleFilter: effectiveRoleFilter,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
    }

    void logComparisonHistoryListRead({
      actor_id: userId,
      actor_email: email,
      context: documentId ? "document" : "global",
      context_document_id: documentId,
      result_count: result.data.items.length,
      has_more: result.data.pageInfo.hasMore,
      sort,
      role_filter: result.data.roleFilter,
    }).catch(() => {});

    return NextResponse.json({
      ...(documentId ? { document_id: documentId } : {}),
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
