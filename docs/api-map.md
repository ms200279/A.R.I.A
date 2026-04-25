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
  - 연결된 read-first 도구: `get_recent_memos`, `search_memos`, `get_weather` (adapter 미설정 시 `not_configured`), `search_web` (adapter 미설정 시 `not_configured`), `list_documents`, `get_document_detail`, `compare_documents`, `analyze_document`.
  - 모델은 절대 브라우저에서 호출하지 않는다. 모든 호출은 Route Handler → `lib/assistant.runAssistant` → `lib/assistant/providers` 경유.

### `/api/documents`

- `GET  /api/documents` — 소유 문서 목록. Query: `limit`(기본 30, 상한 100), `cursor`(ISO·정렬 컬럼 기준 이전 페이지), `sort`=`updated_at`|`created_at`. `lib/documents/list-documents`: RLS + `user_id` 필터, 원문 미선택, 청크·`document_summaries` 배치(`summary`/`analysis` 타입별 `updated_at` 최신) + **`getLatestComparisonForDocumentsBatch`**로 `latest_comparison_*`(정책 A: 이 문서가 참여한 비교·히스토리∪레거시 중 `created_at` 최신 1건과 동일 기준 as 상세) → `latest_*_exists`·짧은 `preview`·`latest_comparison_anchor_role`, `can_compare`. 감사: `document.read.list_started` → (`document.read.list_failed` 선택) → `document.read.list`.
- `GET  /api/documents/[id]` — 본인 문서 상세. `lib/documents/get-document`: 메타 + `loadLatestSummaryReadTripletForUser`로 `latest_summary` / `latest_analysis` + **`getLatestComparisonForDocument`**가 만든 `latest_comparison`(`DocumentLatestComparisonPublic`: `comparison_id`, `current_document_anchor_role`, `related_documents_preview`, `content_preview` 등)·`chunk_count`·`can_summarize`/`can_compare`. 일부 타입 SELECT 실패 시 `document.read.summary_failed` + 해당 필드 null 가능. RLS + `user_id` 명시 검증. 404 `not_found`, 403 `forbidden`. 감사: `document.read.started` → `document.read.detail` \| `document.read.missing` \| `document.read.forbidden`.
- `GET  /api/documents/[id]/summaries` — 본인 문서의 `document_summaries` 조회(read-side). Query: `type`=summary\|comparison\|analysis\|all(기본 all), `latest`=true\|false(기본 true), `limit`=1…100(`latest=false`일 때만, 기본 30). `lib/documents/list-document-summaries`: 문서 소유 검증 → 타입 필터 → 최신 모드면 타입별 최신 1건(`type=all`이면 `latest` 블록에 summary/comparison/analysis), 목록 모드면 `created_at` 내림차순. 응답 `DocumentSummariesListPayload`(청크 미포함). 잘못된 쿼리 400 + `document.read.summaries_failed`(`invalid_type` 등). 문서 없음 404·타인 문서 403 + `summaries_failed`(`not_found`/`forbidden`). 성공 시 `document.read.summaries_started` → `document.read.summaries`. 타입별 최신 맵만 필요하면 `getLatestDocumentSummariesForDocument`(`lib/documents/get-latest-document-summaries`).
- `POST /api/documents/upload` — multipart 업로드 (`file` 필수, `title` 선택). `lib/documents/ingest-upload`: 인증 → 크기/MIME 게이트(`lib/policies/document-upload`, txt/md, 5MiB) → `documents` 행 생성 → Supabase Storage `documents` 버킷(`{user_id}/{document_id}/{safeName}`) → UTF-8 파싱 → `prepareDocumentTextForSummarize` → `document_chunks` 일괄 insert → `parsed_text`·`parsing_status`·`preprocessing_status`·`status` 갱신. PDF 등은 업로드 단계에서 차단. 감사: `document.upload.started` → `row_created` → `storage_succeeded|failed` → `parsing_started` → `parsing_completed|failed` → (`preprocessing_blocked`) → `completed` \| `failed`.
- `POST /api/documents` — (레거시 초안; 실제 업로드는 `/upload` 사용)
- `POST /api/documents/[id]/summarize` — 요약 요청. `lib/documents/summarize-document`: 본인 `user_id` 검증(RLS + 명시) → `document_chunks`(우선) 또는 `parsed_text` → 비신뢰 전처리 → `ResourceKind.document` 로 `runSummarizerWithFallback`(Gemini 시 내부 청크 요약+합성, rule 은 단일 패스). `documents.summary_status`: `in_progress` → 성공 시 `ready`, 빈 요약·저장 실패 시 `failed`. `document_summaries` UPSERT(`document_id`,`summary_type`). `mode`: `regenerate`(기본) \| `if_empty`. HTTP: `document_not_found` 404, `forbidden` 403, `document_not_ready` 409, `document_not_summarizable` 422, `content_policy_violation`/`document_empty` 400, `summary_empty` 502. 상세+요약 동시 조회는 `GET /api/documents/[id]` 또는 `fetchDocumentWithLatestSummary`(전체 `DocumentSummary` 행 필요 시). 감사: `document.summarize.*` → `summarizer.*` → `document.summarized` \| `document.summary.persist.failed`.
- `POST /api/documents/compare` — 다문서 비교. 본문 `{ "document_ids": ["uuid", …] }`(최소 2·최대 8, 순서 유지·중복 제거). `lib/documents/compare-documents`: 본인 소유 검증 → 청크 우선 `loadSanitizedDocumentTextForModel` → 정책 상한 내 비례 절단 → `runCompareDocumentsLlm` → 응답 DTO(`DocumentCompareResultPayload`) + `persisted` + `summary_id` + `comparison_history_id`(히스토리·앵커 저장 성공 시). **저장**: (1) 요청 순서 **첫** `document_id`를 FK로 `document_summaries` UPSERT `summary_type='comparison'`(동일 주 문서는 덮어쓰기, 기존 호환). (2) `comparison_histories` 행 append + `comparison_history_documents`에 참여 문서 전부(`primary`/`peer`, `sort_order`). 히스토리 insert 실패 시 감사 `document.compare.history_failed`·응답은 여전히 200 + `comparison_history_id: null` 가능. HTTP: `compare_requires_two_documents`/`compare_too_many_documents` 400, `forbidden_or_missing_document` 404, `content_policy_violation` 400, `document_empty`/`document_not_summarizable` 422, `document_not_ready` 409, `document_chunks_load_failed` 500. 감사: `document.compare.*`, `document.compare.history_saved`/`history_failed`.
- `GET  /api/documents/[id]/comparisons` — 해당 문서가 **참여한** 비교 히스토리 목록. Query: `limit`(기본 20, 상한 50), `cursor`(base64url JSON 키셋: `created_at`+`id`+`sort`), `sort`=`created_at_desc`\|`created_at_asc`(기본 desc). 응답 `{ document_id, items, pageInfo: { nextCursor, hasMore }, sort }`. `lib/documents/listComparisonHistoriesPage` + `comparison-list-cursor`. DTO 항목에 `current_document_anchor_role` 등 기존 필드 유지. `invalid_cursor`\|`invalid_limit` 400, 문서 미소유 404. 감사: `document.read.comparisons`(실패 시 흐름 유지).
- `GET  /api/comparisons` — (전역) 로그인 사용자의 `comparison_histories` 목록. Query: `documentId`(선택, 있으면 해당 문서 맥락·소유 검증), `limit`, `cursor`, `sort`). 응답 `{ items, pageInfo, sort }`(문서 필터 시 `document_id` 추가). 동일 도메인 서비스 as `/api/documents/[id]/comparisons`.
- `GET  /api/comparisons/[id]` — 비교 히스토리 단건 상세(`ComparisonHistoryDetailPayload` + `is_bookmarked`). Query `from`=`document_id` 선택 시 `current_context` 포함. `lib/documents/get-comparison-history` + `lib/comparisons/isComparisonBookmarked`. 타인/없음 404.
- `POST /api/comparisons/[id]/bookmark` — 로그인 사용자가 해당 비교를 **내부 북마크**에 추가(이미 있으면 idempotent 성공). 본인 `comparison_histories` 가 아니면 404. `lib/comparisons/addComparisonBookmark`. 감사: `comparison.bookmark.added` / 실패 시 `comparison.bookmark.failed`.
- `DELETE /api/comparisons/[id]/bookmark` — 북마크 해제(없으면 idempotent). 204. `lib/comparisons/removeComparisonBookmark`. 감사: `comparison.bookmark.removed`.
- `POST /api/documents/[id]/analyze` — 단일 문서 해석·리스크·후속 질문. `lib/documents/analyze-document`: 소유·비신뢰 텍스트 로드·정책·`runAnalyzeDocumentLlm` → `DocumentAnalyzeResultPayload` + `persisted` + `summary_id`. **저장**: 해당 문서에 `summary_type='analysis'` UPSERT(한 문서당 분석 1행, 재호출 시 덮어쓰기). HTTP: `document_not_found` 404, `forbidden` 403, 기타 summarize 경로와 유사한 정책 코드. 감사: `document.analyze.*`.

### `/api/memos`

- `GET  /api/memos` — 본인 `active` 메모 목록 (RLS). cursor 기반 페이징: `?limit=&cursor=&project_key=&sort=created_at|updated_at` (기본 `updated_at` 내림차순, cursor 는 해당 컬럼 ISO). 응답: `{ items, next_cursor, sort }`. `memo.read.list` 감사.
- `GET  /api/memos/search` — `?q=&limit=&project_key=&tag=` (부분일치: title/content/summary/project_key, `tag`·`project_key` 는 정확 일치 필터·`tag` 우선). `memo.searched` (쿼리 **길이**만, 원문 미로그).
- `GET  /api/memos/[id]` — 단건. 404 시 `memo.read.missing`. 성공 시 `memo.read.detail`.
- `POST /api/memos/create` — pending 저장 요청 (명시 저장만, 기존과 동일).
- `POST /api/memos/[id]/summarize` — `summary` 갱신. `lib/memos/summarize-memo` → `lib/summarizers/runSummarizerWithFallback`(게이트 → Gemini 또는 rule). body/query `mode`: `regenerate`(기본, **항상 덮어쓰기**) \| `if_empty` (이미 있으면 `memo.summarize.skipped`). 선택 body `resource_kind`: 기본 `memo`. `document`\|`mail` 은 계약 검증 후 400(`resource_kind_not_supported_for_memo_endpoint`). 본문이 정책 길이를 넘으면 400(`content_policy_violation`) + `memo.summarize.policy_blocked`. env: `SUMMARIZER_PROVIDER=auto|gemini|rule`, `GEMINI_API_KEY`, `GEMINI_MODEL`. 감사: `summarizer.request.received`(phase started) → `summarizer.safety.evaluated` → (`summarizer.gemini.failed` + `summarizer.fallback.used` 선택) → 저장 후 `summarizer.provider.resolved`(chunked/chunk_count 등) → `memo.summarized`.
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
  - 검증: service_role 재조회 → `SaveMemoPayloadSchema` Zod parse → confirm 시점 `evaluateMemoCreate(..., explicit: true)` + `detectSensitiveContent` → optimistic claim → `memos` INSERT → `pending_actions` 를 `approved` 에서만 `executed` 로 확정(WHERE status=approved).
  - 응답 & HTTP 매핑:
    - `{ status:"executed", action_type:"save_memo", memo_id }` → 200.
    - `{ status:"blocked",  action_type, reason }` → 200 (정책 결정이므로 4xx/5xx 아님).
    - `{ error:"not_found" }` → 404 (소유자 불일치 또는 존재하지 않음).
    - `{ error:"invalid_status", action_type, current_status }` → 409 (재실행 금지; 단 이미 `executed` 이고 `result.kind=memo_saved` 인 `save_memo` 는 멱등 200 + 동일 `memo_id`, `memo.approval.confirm_idempotent`).
    - `{ error:"unsupported_action_type", action_type }` → 400.
    - `{ error:<reason>, action_type }` → 500 (claim_failed / memo_insert_failed 등 일시적 오류).
  - 감사 로그: `memo.approval.executed` (성공) / `memo.approval.confirm_idempotent` (중복 confirm) / `memo.approval.blocked` (정책·payload 차단).
- `POST  /api/approvals/[id]/reject` — 사용자 거절.
  - 도메인 로직: `lib/approvals.rejectPendingAction(id, actor)` → `lib/memos.rejectMemoAction`.
  - 상태 전이: `awaiting_approval → rejected`. `memos` 에는 쓰지 않는다.
  - 응답 & HTTP 매핑:
    - `{ status:"rejected", action_type:"save_memo" }` → 200.
    - `not_found` / `invalid_status` / `unsupported_action_type` / `error` 는 confirm 과 동일 매핑.
  - 감사 로그: `memo.approval.rejected` / 중복 거절 시 `memo.approval.reject_idempotent`.

정책 요약 (memos write):
- `memos` 에 대한 INSERT 경로는 서버의 `executeApprovedMemo` 단 하나. confirm 이전에는 어떤 경로로도 insert 되지 않는다.
- `save_memo` confirm: 이미 `executed` + `memo_saved` 면 200 멱등. 그 외 `rejected` / `blocked` / `approved`(중간) 등에서의 재confirm 은 409.
- reject: 이미 `rejected` 면 200 멱등 로그만; `executed` 등이면 409.

## 금지된 엔드포인트 (의도적으로 만들지 않음)

- `POST /api/mail/send`
- `DELETE /api/**` 전반 (승인 플로우 재설계 전까지)
- 외부 공유/초대 엔드포인트
- 브라우저 자동화 엔드포인트

## TODO

- [ ] 각 엔드포인트의 요청/응답 스키마 (Zod) 정의
- [ ] 인증 방식 확정 (Supabase Auth cookie)
- [ ] 레이트 리밋 전략
