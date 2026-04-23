# app/api/approvals/

승인 대기 액션 관리 엔드포인트.

- 목록/단건 조회, `confirm`, `reject`.
- `confirm` 은 `pending_actions` 의 파라미터로 실제 도메인 액션을 트리거한다.
- 실행 결과는 `execution_log` 에 기록.

**이 엔드포인트가 유일한 "쓰기 실행 트리거" 채널이 되도록 유지한다.**

TODO: route.ts, [id]/route.ts, [id]/confirm/route.ts, [id]/reject/route.ts
