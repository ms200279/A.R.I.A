import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 * - 서버 측 Supabase 세션 쿠키를 정리한다. 실제 Set-Cookie 삭제는 `@supabase/ssr` 쿠키 어댑터가 담당.
 * - 이 핸들러는 얇게 유지하고, 실패/성공을 JSON { ok } 로 명시해 프론트가 분기할 수 있게 한다.
 * - GET 등 다른 메서드는 405 로 차단한다. 로그아웃은 반드시 명시적 POST 로만 수행.
 *
 * 정책 메모:
 * - CSRF: Supabase 세션 쿠키는 SameSite=Lax 기본값이라 일반적인 third-party 요청에서는
 *   전송되지 않는다. 로그아웃은 멱등/저위험 액션이므로 별도 토큰을 요구하지 않는다.
 * - 이 엔드포인트는 "민감 액션 승인 플로우"의 대상이 아니다. 사용자가 의도적으로 자신의
 *   세션을 종료하는 것이기 때문이다.
 */
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
