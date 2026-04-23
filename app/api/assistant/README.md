# app/api/assistant/

자연어 요청의 주 진입점.

- `POST /api/assistant` → `lib/orchestrator.handle()`
- 인텐트 분류와 도메인 라우팅은 orchestrator의 책임. 이 폴더는 얇게.

TODO: route.ts 추가 (런타임 기반 단계 이후).
