import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트 / Route Handler / Server Action 에서 사용하는 Supabase 클라이언트.
 *
 * - 쿠키 기반 세션을 읽고 갱신한다 (`@supabase/ssr`).
 * - Server Component 내부에서 set 이 호출되면 런타임 에러가 날 수 있으므로
 *   try/catch 로 방어한다. 세션 갱신은 middleware 에서 수행되는 것이 정상 경로.
 * - 클라이언트에서 import 되지 않도록 server-only 모듈과만 함께 쓴다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component 에서 호출된 경우 set 이 막혀있다. middleware 에서 갱신하므로 무시.
          }
        },
      },
    },
  );
}

function requireEnv(key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}
