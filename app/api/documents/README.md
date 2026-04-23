# app/api/documents/

문서 업로드/조회/요약/비교 엔드포인트.

- GET 목록/단건, POST 업로드/요약/비교
- 구현은 `lib/documents` 와 `lib/integrations/storage` 분담
- **삭제 엔드포인트는 만들지 않는다** (정책)

TODO: route.ts, [id]/route.ts, [id]/summarize/route.ts, compare/route.ts
