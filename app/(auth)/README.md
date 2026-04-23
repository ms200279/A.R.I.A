# app/(auth)/

로그인/세션 관련 라우트 그룹.

- Supabase Auth 기반 로그인 UI.
- 콜백 라우트 (`/auth/callback` 등)는 이 그룹 또는 `api/` 에 둔다.
- 인증 성공 후 `(dashboard)` 로 리다이렉트.

TODO: 로그인 페이지, 콜백 핸들러, 미들웨어 연동.
