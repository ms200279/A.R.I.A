# API Map — Route Handlers

> 상태: DRAFT
> Route Handler는 얇게 유지하고, 실제 로직은 `lib/<domain>` 에 있다.
> 쓰기 계열은 `lib/policies` 를 반드시 경유한다.

## 네임스페이스 개요

| 경로             | 목적                              | 기본 등급               |
| ---------------- | --------------------------------- | ----------------------- |
| `/api/assistant` | 자연어 요청 진입점 → orchestrator | Read/Suggest 중심       |
| `/api/documents` | 문서 업로드/조회/요약             | Read + Create(low-risk) |
| `/api/memos`     | 메모 CRU (D 없음)                 | Read + Create(low-risk) |
| `/api/mail`      | 메일 읽기/요약/초안               | Read + Suggest          |
| `/api/calendar`  | 일정 읽기/제안                    | Read + Suggest          |
| `/api/search`    | 웹 검색                           | Read (untrusted 결과)   |
| `/api/weather`   | 날씨 조회                         | Read                    |
| `/api/approvals` | 승인 대기 액션의 승인/거절/실행   | Create(approval)        |

## 엔드포인트 초안

### `/api/assistant`

- `POST /api/assistant` — 자연어 요청 처리, 오케스트레이터 호출.

### `/api/documents`

- `GET  /api/documents` — 소유 문서 목록
- `GET  /api/documents/[id]` — 문서 메타
- `POST /api/documents` — 업로드 (metadata + storage path)
- `POST /api/documents/[id]/summarize` — 요약 요청
- `POST /api/documents/compare` — 다문서 비교

### `/api/memos`

- `GET  /api/memos` — 목록
- `GET  /api/memos/[id]` — 단건
- `POST /api/memos` — 생성 (사용자 명시 저장만)
- `PATCH /api/memos/[id]` — 수정
- **삭제 엔드포인트 없음** (정책상 비활성)

### `/api/mail`

- `GET  /api/mail/threads` — 스레드 목록
- `GET  /api/mail/threads/[id]` — 단건
- `POST /api/mail/threads/[id]/summarize`
- `POST /api/mail/threads/[id]/draft-reply` — 답장 초안 생성
- **발송 엔드포인트 없음** (정책상 비활성)

### `/api/calendar`

- `GET  /api/calendar/events` — 기간 조회
- `POST /api/calendar/propose` — 슬롯 제안 생성
- `POST /api/calendar/create-from-approval` — 승인된 pending_action 기반 실제 생성
  - (또는 `/api/approvals/[id]/confirm` 에서 라우팅)

### `/api/search`

- `POST /api/search` — 쿼리 실행, 결과는 untrusted로 표시

### `/api/weather`

- `GET /api/weather` — 위치 기반 현재/예보

### `/api/approvals`

- `GET   /api/approvals` — 대기 목록
- `GET   /api/approvals/[id]` — 단건
- `POST  /api/approvals/[id]/confirm` — 승인 후 실제 실행 트리거
- `POST  /api/approvals/[id]/reject` — 거절

## 금지된 엔드포인트 (의도적으로 만들지 않음)

- `POST /api/mail/send`
- `DELETE /api/**` 전반 (승인 플로우 재설계 전까지)
- 외부 공유/초대 엔드포인트
- 브라우저 자동화 엔드포인트

## TODO

- [ ] 각 엔드포인트의 요청/응답 스키마 (Zod) 정의
- [ ] 인증 방식 확정 (Supabase Auth cookie)
- [ ] 레이트 리밋 전략
