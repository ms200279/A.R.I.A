import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트.
 *
 * - `NEXT_PUBLIC_*` 값만 사용한다. service_role 키는 절대 이 파일에서 참조하지 않는다.
 * - 호출마다 새 인스턴스가 반환되므로, 필요 시 훅에서 useMemo 로 감싸 재사용한다.
 */
export function createClient() {
  return createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

function requireEnv(key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}
