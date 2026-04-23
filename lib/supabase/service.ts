import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 권한으로 동작하는 서버 전용 Supabase 클라이언트.
 *
 * 사용 규칙 (매우 중요):
 * - 절대 브라우저/클라이언트 컴포넌트에서 import 하지 않는다. `server-only` 가드로 강제한다.
 * - 일반 사용자 요청 흐름에서는 RLS 가 걸린 `server.ts` 를 써라. 이 클라이언트는 RLS 를 우회한다.
 * - 사용 허용 범위: 감사 로그 기록, 스케줄 작업, 관리자 백필, 사용자 초기 프로필 생성 등.
 * - 모든 호출 지점은 `lib/logging` 으로 감사 기록을 남긴다.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
