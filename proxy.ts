import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 Proxy (구 middleware) 파일.
 *
 * 역할:
 * - Supabase 쿠키 기반 세션을 갱신한다.
 * - 보호 라우트 진입 시 로그인 페이지로 리다이렉트한다.
 *
 * 참고:
 * - (auth) 와 (dashboard) 는 라우트 그룹이므로 URL 경로에 등장하지 않는다.
 * - 공개 경로: `/login`, `/callback`, `/auth/*`, `/error`, 정적 리소스.
 * - 그 외 모든 경로는 로그인 필요.
 */

const PUBLIC_PATHS = ["/login", "/callback", "/auth", "/error"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 환경변수가 없으면 세션 갱신 없이 그대로 통과시킨다 (초기 스캐폴드 단계 관대함).
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * 정적 리소스 / 이미지 / 파비콘 제외. 나머지는 전부 통과.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
