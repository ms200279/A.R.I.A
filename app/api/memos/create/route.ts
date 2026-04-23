import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createMemoDraft } from "@/lib/memos";

export const dynamic = "force-dynamic";

const CreateMemoBodySchema = z.object({
  content: z.string().min(1).max(50_000),
  title: z.string().max(500).optional().nullable(),
  source_type: z.enum(["quick_capture", "chat", "import"]).optional(),
  project_key: z.string().max(200).optional().nullable(),
  explicit: z.boolean(),
});

/**
 * POST /api/memos/create
 * 명시 저장 요청. 결코 바로 저장하지 않고, pending_action 생성까지만 수행.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateMemoBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createMemoDraft(parsed.data, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  });

  if (result.status === "blocked") {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result, { status: 202 });
}
