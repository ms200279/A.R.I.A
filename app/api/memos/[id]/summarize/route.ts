import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { summarizeMemo, type SummarizeMode } from "@/lib/memos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MODES: SummarizeMode[] = ["regenerate", "if_empty"];

function parseMode(v: string | null): SummarizeMode | undefined {
  if (v === "regenerate" || v === "if_empty") return v;
  return undefined;
}

/**
 * POST /api/memos/[id]/summarize
 * 본인 메모에만 동작. 요약 문장 생성은 `lib/summarizers`(Gemini + rule fallback)가 담당한다.
 *
 * - 기본 `mode=regenerate`: 항상 새 요약으로 `summary` 덮어쓰기.
 * - `mode=if_empty`: 이미 summary 가 있으면 갱신하지 않고 기존 행 반환.
 *
 * `mode` 는 JSON body `{ "mode": "..." }` 우선, 없으면 query `?mode=`.
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

  let bodyMode: SummarizeMode | undefined;
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

  const mode: SummarizeMode = bodyMode ?? queryMode ?? "regenerate";

  const result = await summarizeMemo(
    id,
    {
      user_id: userData.user.id,
      user_email: userData.user.email ?? null,
    },
    { mode },
  );

  if (result.status === "error") {
    const status =
      result.reason === "forbidden"
        ? 403
        : result.reason === "memo_not_found"
          ? 404
          : 500;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ memo: result.memo, mode });
}
