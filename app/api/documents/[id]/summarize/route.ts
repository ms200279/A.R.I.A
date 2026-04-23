import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  summarizeDocument,
  type SummarizeDocumentMode,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MODES: SummarizeDocumentMode[] = ["regenerate", "if_empty"];

function parseMode(v: string | null): SummarizeDocumentMode | undefined {
  if (v === "regenerate" || v === "if_empty") return v;
  return undefined;
}

/**
 * POST /api/documents/[id]/summarize
 *
 * 본인 문서만 요약. 로직은 `lib/documents/summarize-document` 에 위임한다.
 *
 * - 기본 `mode=regenerate`: 요약 실행 후 `document_summaries` UPSERT.
 * - `mode=if_empty`: 기존 `summary` 가 있으면 생략.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const queryMode = parseMode(url.searchParams.get("mode"));
  if (url.searchParams.has("mode") && queryMode === undefined) {
    return NextResponse.json(
      { error: "invalid_mode", allowed: MODES },
      { status: 400 },
    );
  }

  let bodyMode: SummarizeDocumentMode | undefined;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as { mode?: unknown };
      if (body?.mode !== undefined && body?.mode !== null) {
        const parsed = parseMode(String(body.mode));
        if (!parsed) {
          return NextResponse.json(
            { error: "invalid_mode", allowed: MODES },
            { status: 400 },
          );
        }
        bodyMode = parsed;
      }
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  const mode: SummarizeDocumentMode = bodyMode ?? queryMode ?? "regenerate";

  const result = await summarizeDocument(
    id,
    {
      user_id: userData.user.id,
      user_email: userData.user.email ?? null,
    },
    { mode },
  );

  if (result.status === "error") {
    const statusMap: Record<string, number> = {
      document_not_found: 404,
      forbidden: 403,
      document_empty: 400,
      document_not_ready: 409,
      document_not_summarizable: 422,
      content_policy_violation: 400,
      summary_empty: 502,
      summary_persist_failed: 500,
      document_chunks_load_failed: 500,
    };
    const status = statusMap[result.reason] ?? 500;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ summary: result.summary, mode });
}
