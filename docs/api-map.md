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
  - 쓰기 계열은 **2 단계 write-safe proposal** 구조로만 수행된다. 모델이 `memos` 테이블에 직접 INSERT 하는 경로는 어느 경우에도 없다.
    1. `propose_save_memo` — **미리보기 only**. DB 에 쓰지 않고 저장 예정 본문/제목/`sensitivity_flag` 만 구조화해 반환한다. `assistant.proposal.generated` 감사 로그.
    2. `create_pending_action_for_memo` — `pending_actions` 에 `action_type=save_memo, status=awaiting_approval` 로 INSERT. 호출 직전 서버에서 `evaluateSaveMemoIntent(user_message)` 로 현재 턴이 명시적 저장/동의 의도인지 재검증한다. 의도가 불명확하면 INSERT 전에 `assistant.save_intent.blocked` 로그와 함께 차단되고, 모델은 `create_pending_action_for_memo` 가 `blocked` 반환을 받는다. 실제 `memos` 저장은 여전히 `/api/approvals/[id]/confirm` 만 담당한다.
  - 응답 유형 매핑:
    - pending_action 이 만들어졌으면 → `approval_required` + `pending_action_ids`.
    - `propose_save_memo` 만 호출되고 pending 이 없으면 → `proposed_action` (Stage 1 의 저장 확인 질문).
    - 도구가 `blocked` 반환하면 → `blocked`.
    - 그 외 텍스트 기반 판정으로 `clarification_question` / `direct_answer`.
  - 연결된 read-first 도구: `get_recent_memos`, `search_memos`, `get_weather` (adapter 미설정 시 `not_configured`), `search_web` (adapter 미설정 시 `not_configured`).
  - 모델은 절대 브라우저에서 호출하지 않는다. 모든 호출은 Route Handler → `lib/assistant.runAssistant` → `lib/assistant/providers` 경유.

### `/api/documents`

- `GET  /api/documents` — 소유 문서 목록
- `GET  /api/documents/[id]` — 문서 메타
- `POST /api/documents` — 업로드 (metadata + storage path)
- `POST /api/documents/[id]/summarize` — 요약 요청
- `POST /api/documents/compare` — 다문서 비교

### `/api/memos`

- `GET  /api/memos` — 본인 `active` 메모 목록 (RLS). cursor 기반 페이징: `?limit=&cursor=&project_key=&sort=created_at|updated_at` (기본 `updated_at` 내림차순, cursor 는 해당 컬럼 ISO). 응답: `{ items, next_cursor, sort }`. `memo.read.list` 감사.
- `GET  /api/memos/search` — `?q=&limit=&project_key=&tag=` (부분일치: title/content/summary/project_key, `tag`·`project_key` 는 정확 일치 필터·`tag` 우선). `memo.searched` (쿼리 **길이**만, 원문 미로그).
- `GET  /api/memos/[id]` — 단건. 404 시 `memo.read.missing`. 성공 시 `memo.read.detail`.
- `POST /api/memos/create` — pending 저장 요청 (명시 저장만, 기존과 동일).
- `POST /api/memos/[id]/summarize` — `summary` 갱신. `lib/summarizers` (Gemini 가능 시) → 실패 시 `rule_based_v1` fallback. env: `SUMMARIZER_PROVIDER=auto|gemini|rule`, `GEMINI_API_KEY`, `GEMINI_MODEL`. body/query `mode`: `regenerate`(기본, **항상 덮어쓰기**) | `if_empty` (이미 있으면 `memo.summarize.skipped`, DB 미변경). 감사: `summarizer.request.received` → (`summarizer.gemini.failed` + `summarizer.fallback.used` 선택) → `memo.summary` 저장 후 `summarizer.provider.resolved` → `memo.summarized`. 저장 실패 시 `memo.summary.persist.failed`.
- `PATCH/DELETE` — 없음

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

- `GET   /api/approvals` — 현재 사용자의 `awaiting_approval` 목록 (RLS 경유, `{ items: SaveMemoPending[] }`).
- `POST  /api/approvals/[id]/confirm` — 승인 후 실제 실행 트리거.
  - 도메인 로직: `lib/approvals.confirmPendingAction(id, actor)` → action_type 별 위임 (`save_memo` → `lib/memos.executeApprovedMemo`).
  - 상태 전이: `awaiting_approval → approved → executed` (성공) / `awaiting_approval → blocked` (payload/정책 재검증 실패) / 실행 실패 시 `approved → awaiting_approval` 로 rollback.
  - 검증: service_role 재조회로 소유자/action_type/status 확인 → `SaveMemoPayloadSchema` Zod parse → `detectSensitiveContent` 로 `sensitivity_flag` 재산출 → optimistic claim → `memos` INSERT.
  - 응답 & HTTP 매핑:
    - `{ status:"executed", action_type:"save_memo", memo_id }` → 200.
    - `{ status:"blocked",  action_type, reason }` → 200 (정책 결정이므로 4xx/5xx 아님).
    - `{ error:"not_found" }` → 404 (소유자 불일치 또는 존재하지 않음).
    - `{ error:"invalid_status", action_type, current_status }` → 409 (이미 executed/rejected/blocked 등).
    - `{ error:"unsupported_action_type", action_type }` → 400.
    - `{ error:<reason>, action_type }` → 500 (claim_failed / memo_insert_failed 등 일시적 오류).
  - 감사 로그: `memo.approval.executed` (성공) / `memo.approval.blocked` (정책·payload 차단).
- `POST  /api/approvals/[id]/reject` — 사용자 거절.
  - 도메인 로직: `lib/approvals.rejectPendingAction(id, actor)` → `lib/memos.rejectMemoAction`.
  - 상태 전이: `awaiting_approval → rejected`. `memos` 에는 쓰지 않는다.
  - 응답 & HTTP 매핑:
    - `{ status:"rejected", action_type:"save_memo" }` → 200.
    - `not_found` / `invalid_status` / `unsupported_action_type` / `error` 는 confirm 과 동일 매핑.
  - 감사 로그: `memo.approval.rejected`.

정책 요약 (memos write):
- `memos` 에 대한 INSERT 경로는 서버의 `executeApprovedMemo` 단 하나. confirm 이전에는 어떤 경로로도 insert 되지 않는다.
- 이미 `executed` / `rejected` / `blocked` / `approved` 인 pending_action 은 재confirm/재reject 가 모두 409 로 차단된다.

## 금지된 엔드포인트 (의도적으로 만들지 않음)

- `POST /api/mail/send`
- `DELETE /api/**` 전반 (승인 플로우 재설계 전까지)
- 외부 공유/초대 엔드포인트
- 브라우저 자동화 엔드포인트

## TODO

- [ ] 각 엔드포인트의 요청/응답 스키마 (Zod) 정의
- [ ] 인증 방식 확정 (Supabase Auth cookie)
- [ ] 레이트 리밋 전략
