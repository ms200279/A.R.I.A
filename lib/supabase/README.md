# lib/supabase/

Supabase 클라이언트 팩토리.

계획되는 파일:
- `server.ts` — 서버 컴포넌트/Route Handler용 (cookies 기반 세션).
- `browser.ts` — 클라이언트 컴포넌트용.
- `service.ts` — 서버 전용 service role 클라이언트. **절대 클라이언트로 노출 금지.**

규칙:
- service role 키는 `process.env` 에서 서버에서만 읽는다.
- RLS는 항상 켜진 상태를 전제로 쿼리한다.

TODO: 실제 클라이언트 구현은 런타임 기반 단계에서.
