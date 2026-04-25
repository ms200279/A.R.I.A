import { NextResponse } from "next/server";
import { z } from "zod";

import { runAssistant } from "@/lib/assistant";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QueryBodySchema = z.object({
  message: z.string().min(1).max(10_000),
  session_id: z.string().max(200).optional().nullable(),
});

/**
 * POST /api/assistant/query
 *
 * 얇은 Route Handler:
 *  1) 서버 세션 확인 (미인증 → 401)
 *  2) 본문 Zod 검증 (형식 오류 → 400)
 *  3) `lib/assistant.runAssistant` 로 위임
 *  4) 실행 결과(성공/차단/실패)를 항상 200 + 구조화된 answer 로 반환
 *
 * 설계 포인트:
 *  - runAssistant 는 throw 하지 않고 항상 { ok: true, data } 를 돌려준다.
 *    provider/도구/정책 오류는 data.answer.kind === "blocked" 로 정규화된다.
 *  - 그래서 HTTP 상태는 auth/body 문제일 때만 비-200 이다. 그 외에는 200.
 *  - 모델 호출은 절대 여기서 직접 하지 않는다. 브라우저가 Gemini/OpenAI 로 직접 요청하는 경로도 없다.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = QueryBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await runAssistant({
    userMessage: parsed.data.message,
    ctx: {
      user_id: userData.user.id,
      user_email: userData.user.email ?? null,
      session_id: parsed.data.session_id ?? null,
    },
  });

  return NextResponse.json({
    answer: result.data.answer,
    tool_trace: result.data.tool_trace,
    pending_action_ids: result.data.pending_action_ids,
    iterations: result.data.iterations,
    provider: result.provider,
    ui_attachments: result.data.ui_attachments,
  });
}
