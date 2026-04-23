import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트 / Route Handler / Server Action 에서 사용하는 Supabase 클라이언트.
 *
 * - 쿠키 기반 세션을 읽고 갱신한다 (`@supabase/ssr`).
 * - Server Component 내부에서 set 이 호출되면 런타임 에러가 날 수 있으므로
 *   try/catch 로 방어한다. 세션 갱신은 middleware 에서 수행되는 것이 정상 경로.
 * - 클라이언트에서 import 되지 않도록 server-only 모듈과만 함께 쓴다.
 *
 * 구현 메모:
 * - `browser.ts` 와 동일한 이유로 환경변수는 리터럴로 참조한다. 서버 측에서는
 *   동적 접근도 동작하지만, 일관성을 위해 같은 패턴을 사용한다.
 */
const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const SUPABASE_ANON_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  });
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
