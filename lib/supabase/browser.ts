import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트.
 *
 * - `NEXT_PUBLIC_*` 값만 사용한다. service_role 키는 절대 이 파일에서 참조하지 않는다.
 * - 호출마다 새 인스턴스가 반환되므로, 필요 시 훅에서 useMemo 로 감싸 재사용한다.
 *
 * 구현 메모:
 * - Next.js 는 `process.env.NEXT_PUBLIC_*` 를 **리터럴 형태**일 때만 빌드 타임에
 *   정적 치환한다. 동적 키 접근(`process.env[key]`) 은 브라우저 번들에서 치환되지
 *   않아 런타임에 `undefined` 로 평가되므로, 반드시 리터럴로 참조한다.
 */
const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const SUPABASE_ANON_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
