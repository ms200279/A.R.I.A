import { NextResponse } from "next/server";

import {
  listDocumentSummaries,
  type ListDocumentSummariesOptions,
} from "@/lib/documents/list-document-summaries";
import { logDocumentReadSummariesFailed } from "@/lib/logging/audit-log";
import {
  DOCUMENT_SUMMARIES_LIST_DEFAULT_LIMIT,
  DOCUMENT_SUMMARIES_LIST_MAX_LIMIT,
  isValidDocumentSummariesTypeQuery,
  parseDocumentSummariesLimit,
} from "@/lib/policies/document-summaries-read";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]/summaries
 * Query: `type` = summary | comparison | analysis | all (기본 all)
 *        `latest` = true | false (기본 true)
 *        `limit` = 1…100 — `latest=false` 일 때만 (기본 30)
 */
export async function GET(request: Request, { params }: Params) {
  const { id: documentId } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeRaw = url.searchParams.get("type") ?? "all";
  if (!isValidDocumentSummariesTypeQuery(typeRaw)) {
    await logDocumentReadSummariesFailed({
      actor_id: userData.user.id,
      actor_email: userData.user.email ?? null,
      document_id: documentId,
      source: "api",
      error_code: "invalid_type",
    });
    return NextResponse.json(
      { error: "invalid_type", allowed: ["summary", "comparison", "analysis", "all"] },
      { status: 400 },
    );
  }

  const latestRaw = url.searchParams.get("latest") ?? "true";
  if (latestRaw !== "true" && latestRaw !== "false") {
    await logDocumentReadSummariesFailed({
      actor_id: userData.user.id,
      actor_email: userData.user.email ?? null,
      document_id: documentId,
      source: "api",
      error_code: "invalid_latest",
    });
    return NextResponse.json(
      { error: "invalid_latest", allowed: ["true", "false"] },
      { status: 400 },
    );
  }
  const latest = latestRaw === "true";

  let limit = DOCUMENT_SUMMARIES_LIST_DEFAULT_LIMIT;
  if (!latest) {
    const parsedLimit = parseDocumentSummariesLimit(
      url.searchParams.get("limit"),
      DOCUMENT_SUMMARIES_LIST_DEFAULT_LIMIT,
    );
    if (!parsedLimit.ok) {
      await logDocumentReadSummariesFailed({
        actor_id: userData.user.id,
        actor_email: userData.user.email ?? null,
        document_id: documentId,
        source: "api",
        error_code: "invalid_limit",
      });
      return NextResponse.json(
        {
          error: "invalid_limit",
          max: DOCUMENT_SUMMARIES_LIST_MAX_LIMIT,
          min: 1,
        },
        { status: 400 },
      );
    }
    limit = parsedLimit.limit;
  }

  const options: ListDocumentSummariesOptions = {
    type: typeRaw,
    latest,
    limit,
  };

  const result = await listDocumentSummaries(supabase, documentId, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
    source: "api",
  }, options);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (result.reason === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "query_failed", message: result.error_message ?? null },
      { status: 500 },
    );
  }

  return NextResponse.json(result.data);
}
