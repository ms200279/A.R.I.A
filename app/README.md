# app/

Next.js App Router 루트.

- 페이지/레이아웃과 **얇은** Route Handler만 둔다.
- 비즈니스 로직은 `lib/<domain>` 으로 위임한다.
- 외부 API 직접 호출 금지 → `lib/integrations/*` 경유.

## 서브디렉토리

- `(auth)/` — 로그인/세션 관련 UI.
- `(dashboard)/` — 보호된 메인 UI (채팅, 문서, 메모, 캘린더 등).
- `api/` — Route Handlers. 도메인별 하위 디렉토리.

TODO: `layout.tsx`, `page.tsx`, 전역 프로바이더는 런타임 기반 단계에서 추가.
