# lib/

서버 사이드 도메인 / 인프라 로직 루트.

서브 모듈:

- `supabase/` — Supabase 클라이언트 3종 (server, browser, service).
- `orchestrator/` — 자연어 요청 라우팅 및 결과 합성.
- `safety/` — 비신뢰 입력 전처리, 인젝션 완화.
- `policies/` — 액션 등급/승인 판정.
- `logging/` — 감사/정책 위반/실행 로그.
- `documents/`, `memos/`, `mail/`, `calendar/` — 도메인 로직.
- `integrations/` — 외부 API 어댑터.

규칙:

- 각 도메인 모듈은 `index.ts` 로 공개 API를 좁힌다.
- `app/` 에서 직접 외부 API를 호출하지 않는다. 이 폴더를 경유한다.
