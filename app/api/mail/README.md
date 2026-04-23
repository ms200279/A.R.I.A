# app/api/mail/

메일 읽기/요약/답장 초안 엔드포인트.

- 메일은 **읽기 중심**. 발송은 이번 범위 밖.
- `POST /api/mail/send` **금지** (정책).
- 답장 초안은 `drafts` 테이블에 저장만 하고, 발송은 하지 않는다.

TODO: threads/route.ts, threads/[id]/route.ts, threads/[id]/summarize/route.ts, threads/[id]/draft-reply/route.ts
