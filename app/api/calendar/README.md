# app/api/calendar/

캘린더 읽기/제안 엔드포인트.

- 생성은 **승인 후 실행**: `/api/approvals/[id]/confirm` 또는 `create-from-approval` 경로.
- 삭제/수정 엔드포인트는 승인 매트릭스 확정 전까지 만들지 않는다.

TODO: events/route.ts, propose/route.ts, create-from-approval/route.ts
