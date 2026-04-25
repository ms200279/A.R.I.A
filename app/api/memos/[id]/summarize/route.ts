import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { summarizeMemo, type SummarizeMode } from "@/lib/memos";
import type { ResourceKind } from "@/lib/summarizers/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MODES: SummarizeMode[] = ["regenerate", "if_empty"];

const RESOURCE_KINDS: ResourceKind[] = ["memo", "document", "mail"];

function parseMode(v: string | null): SummarizeMode | undefined {
  if (v === "regenerate" || v === "if_empty") return v;
  return undefined;
}

function parseResourceKind(v: unknown): ResourceKind | undefined {
  if (v === "memo" || v === "document" || v === "mail") return v;
  return undefined;
}

/**
 * POST /api/memos/[id]/summarize
 * 본인 메모에만 동작. 요약 문장 생성은 `lib/summarizers`(게이트 + Gemini + rule fallback)가 담당한다.
 *
 * - 기본 `mode=regenerate`: 항상 새 요약으로 `summary` 덮어쓰기.
 * - `mode=if_empty`: 이미 summary 가 있으면 갱신하지 않고 기존 행 반환.
 *
 * `mode` 는 JSON body `{ "mode": "..." }` 우선, 없으면 query `?mode=`.
 *
 * `resource_kind`(선택, 기본 `memo`): 이 엔드포인트는 메모 리소스만 처리한다.
 * `document` / `mail` 은 계약 검증 후 400 을 반환한다(전용 라우트는 후속).
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
    return NextResponse.json({ error: "invalid_mode", allowed: MODES }, { status: 400 });
  }

  let bodyMode: SummarizeMode | undefined;
  let bodyResourceKind: ResourceKind | undefined;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as {
        mode?: unknown;
        resource_kind?: unknown;
      };
      if (body?.mode !== undefined && body?.mode !== null) {
        const parsed = parseMode(String(body.mode));
        if (!parsed) {
          return NextResponse.json({ error: "invalid_mode", allowed: MODES }, { status: 400 });
        }
        bodyMode = parsed;
      }
      if (body?.resource_kind !== undefined && body?.resource_kind !== null) {
        const rk = parseResourceKind(body.resource_kind);
        if (!rk) {
          return NextResponse.json(
            {
              error: "invalid_resource_kind",
              allowed: RESOURCE_KINDS,
            },
            { status: 400 },
          );
        }
        bodyResourceKind = rk;
      }
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  const resourceKind: ResourceKind = bodyResourceKind ?? "memo";
  if (resourceKind !== "memo") {
    return NextResponse.json(
      {
        error: "resource_kind_not_supported_for_memo_endpoint",
        resource_kind: resourceKind,
        hint: "Use the memo-specific id with resource_kind=memo, or a future document/mail summarize route.",
      },
      { status: 400 },
    );
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
          : result.reason === "content_policy_violation"
            ? 400
            : 500;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ memo: result.memo, mode, resource_kind: resourceKind });
}
