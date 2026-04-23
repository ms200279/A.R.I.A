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

- `POST /api/assistant/query` — 자연어 요청 진입점 (read-first).
  - 서버 전용 **provider-agnostic** assistant 로 구동된다.
    - 기본 provider: **Gemini** (`@google/genai`).
    - 대체 provider: **OpenAI** Responses API. `ASSISTANT_PROVIDER=openai` 로 전환.
  - 본문: `{ message: string, session_id?: string | null }`.
  - 응답: `{ answer: AssistantAnswer, tool_trace, pending_action_ids, iterations, provider }`.
  - `AssistantAnswer.kind` ∈ `direct_answer | clarification_question | proposed_action | approval_required | blocked`.
  - HTTP 상태는 auth(401) / body 검증(400) 에서만 비-200. provider/도구/정책 오류는 **항상 200 + `answer.kind=blocked`** 으로 정규화(graceful failure).
  - **Pre-gate 정책**: 메일 발송/삭제/공유/웹 자동화 같은 명령형 금지 요청은 LLM 호출 없이 즉시 `blocked` 응답과 `assistant.policy.blocked` 감사 로그가 남는다.
  - 쓰기 계열 tool (현재는 `propose_save_memo`) 은 이번 단계에서 **pending_action 을 만들지 않는다**. proposal 미리보기만 반환하고, 실제 저장은 사용자가 `/memos` UI 에서 명시적으로 수행한다.
  - 연결된 read-first 도구: `get_recent_memos`, `search_memos`, `get_weather` (adapter 미설정 시 `not_configured`), `search_web` (adapter 미설정 시 `not_configured`).
  - 모델은 절대 브라우저에서 호출하지 않는다. 모든 호출은 Route Handler → `lib/assistant.runAssistant` → `lib/assistant/providers` 경유.

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
