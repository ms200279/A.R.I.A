import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { patchMemoReadSideFlags } from "@/lib/memos/patch-memo-flags";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    pinned: z.boolean().optional(),
    bookmarked: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.pinned === undefined && val.bookmarked === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "at_least_one_flag",
      });
    }
  });

/**
 * PATCH /api/memos/[id]/flags
 * read-side: 핀·북마크만( 승인 흐름과 무관).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: memoId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await patchMemoReadSideFlags(
    memoId,
    {
      user_id: userData.user.id,
    },
    parsed.data,
  );

  if (result.ok === false) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
