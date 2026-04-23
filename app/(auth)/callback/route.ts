import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase 이메일 OTP / OAuth 흐름의 콜백 수신점.
 * - `?code=<...>` 를 받아 서버 쿠키 기반 세션으로 교환한다.
 * - 성공 시 `next` 쿼리 파라미터로 돌려보내거나 `/` 로 보낸다.
 * - 실패 시 `/error` 로 보낸다. (에러 페이지는 최소 골격)
 *
 * 공급자별 세부(OAuth state 검증 등) 확장은 후속 단계에서 처리한다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/error?reason=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/error", origin);
    url.searchParams.set("reason", "exchange_failed");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
