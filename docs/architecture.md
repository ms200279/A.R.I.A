# Architecture — aria

> 상태: DRAFT

## 레이어

```
┌──────────────────────────────────────────────────────┐
│  app/                                                │
│    (auth)/        ← 로그인, 세션                       │
│    (dashboard)/   ← 메인 UI (채팅/문서/메모/캘린더)      │
│    api/           ← 얇은 Route Handlers              │
└──────────────┬───────────────────────────────────────┘
               │ 호출
┌──────────────▼───────────────────────────────────────┐
│  lib/                                                │
│    orchestrator/  ← 요청 → 도메인 라우팅               │
│    safety/        ← 비신뢰 입력 전처리, PII, 인젝션 완화│
│    policies/      ← 승인 판단, 액션 분류               │
│    logging/       ← 감사 / 정책 위반 / 실행 로그       │
│    documents/     ← 문서 도메인(요약: summarize-document → summarizers) │
│    memos/         ← 메모 도메인                        │
│    mail/          ← 메일 도메인 (읽기 중심)            │
│    calendar/      ← 캘린더 도메인                      │
│    integrations/  ← Gmail, GCal, 웹검색, 날씨 어댑터   │
│    summarizers/  ← provider-agnostic 텍스트 요약 (rule / Gemini; 실패 시 fallback)  │
│    supabase/      ← Supabase 클라이언트/헬퍼           │
└──────────────┬───────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────┐
│  Supabase (Postgres + Auth + Storage + RLS)          │
│  + 외부 API (Gmail, Google Calendar, 검색, 날씨)       │
└──────────────────────────────────────────────────────┘
```

## 모듈 책임 요약

- **orchestrator**: 사용자의 자연어 요청을 받아 어떤 도메인 모듈을 호출할지 결정하고 결과를 합성한다. 직접 I/O 하지 않는다.
- **safety**: 외부 입력을 untrusted로 표시, 전처리(요약/섹션 추출/인용화), 지시성 문장 제거/격리.
- **policies**: 액션 등급을 판정하고, 승인 필요 여부를 돌려준다. 실제 승인 UI는 app에서 담당.
- **logging**: 감사 로그, 정책 위반 로그, 실행 로그. 원문 대신 포인터/요약 저장.
- **documents/memos/mail/calendar**: 도메인 로직. Supabase / integrations 를 통해 I/O.
- **documents.summarize**: `document_chunks`·`parsed_text` 로 입력을 구성하고 비신뢰 전처리 후 `runSummarizerWithFallback`( `ResourceKind.document` )로 요약; `document_summaries` 에 UPSERT.
- **integrations**: 외부 API 어댑터. 토큰 관리, 레이트 리밋, 에러 매핑.
- **summarizers**: `ResourceKind`(memo \| document \| mail) 기반 공통 계약(`SummarizerInput`/`SummarizerOutput`, `SummarizerAdapter`). `runSummarizerWithFallback` 가 `lib/safety/summarize-provider-gate` 로 외부 LLM 호출 전 게이트를 통과시킨 뒤, `SUMMARIZER_PROVIDER`·키에 따라 Gemini 또는 `rule_based_v1` 을 선택한다. 긴 본문은 `MAX_USER_CONTENT_CHARS` 기준으로 청크 요약 후 합성(Gemini 경로). Gemini 실패 시 rule 로 복구.
- **supabase**: 서버/클라이언트/서비스 역할용 클라이언트 분리.

## 런타임 흐름 (예: 문서 요약)

1. `POST /api/assistant` 에 사용자 요청 도착.
2. Route Handler 가 세션 확인 → `lib/orchestrator.handle()` 호출.
3. Orchestrator 가 "문서 요약" 인텐트 분류 → `lib/documents.summarize()`.
4. `documents` 가 Storage에서 원문 포인터를 읽고, `safety.prepareUntrusted()` 로 전처리.
5. LLM 호출 후 요약 반환. 쓰기 없음 → 로그만 남기고 종료.

## 런타임 흐름 (예: 캘린더 생성)

1. `POST /api/assistant` → orchestrator → `calendar.propose()` → 초안 반환.
2. 사용자가 UI에서 승인 → `POST /api/approvals/[id]/confirm`.
3. Route Handler → `policies.evaluate()` 통과 → `calendar.createFromApproval()` 실행.
4. `integrations/google-calendar` 를 통해 외부 API 호출.
5. `execution_log` 기록.

## 외부 의존

- Supabase (DB/Auth/Storage)
- Google (Gmail, Calendar) — OAuth, 최소 스코프 (TODO: 목록 확정)
- 검색 API (TODO: 공급자 선정)
- 날씨 API (TODO: 공급자 선정)
- LLM 공급자 (TODO: 선정)

## TODO

- [ ] 주요 시퀀스 다이어그램 추가
- [ ] 배포 토폴로지(Vercel + Supabase) 도식
- [ ] 에러 처리/재시도 전략
