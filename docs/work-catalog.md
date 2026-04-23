# Work Catalog — 작업 카탈로그

> 상태: DRAFT
> 앞으로 수행할 작업을 도메인/단계별로 모아둔다. 우선순위는 매 마일스톤에서 재정렬한다.

## 범례

- `[P0]` 반드시 먼저. 기반.
- `[P1]` 핵심 기능.
- `[P2]` 주요 부가.
- `[P3]` 나중.
- `[BLOCKED]` 정책/설계 확정 전까지 착수 금지.

---

## 0. Bootstrap (이번 단계에서 완료)

- [x] `.cursor/rules/*.mdc` 3종
- [x] `AGENTS.md`
- [x] `docs/*.md` 8종
- [x] 폴더 골격 (`app/`, `lib/`, `components/`, `types/`, `supabase/migrations/`)
- [x] 부트스트랩 계획 문서

## 1. 런타임 기반 [P0]

- [ ] Next.js 프로젝트 스캐폴드 (package.json, tsconfig, next.config, ESLint)
- [ ] Tailwind 또는 선택한 스타일 파이프라인 결정
- [ ] 환경 변수 스펙 및 `.env.example`
- [ ] Supabase 프로젝트 연결 (`lib/supabase/*` 클라이언트 3종: server, browser, service)
- [ ] Supabase Auth 로그인 플로우 (이메일 OTP 또는 Google)
- [ ] 기본 레이아웃과 보호된 라우트 게이트

## 2. 데이터 계층 [P0]

- [ ] `supabase/migrations/` 네이밍 규칙 확정
- [ ] `profiles`, `sessions`, `session_messages` 마이그레이션
- [ ] `memos` 마이그레이션 (+ RLS)
- [ ] `documents` + Storage 버킷 + RLS
- [ ] `drafts`, `pending_actions`, `execution_log` 마이그레이션
- [ ] `audit_log`, `policy_violation_log` 마이그레이션

## 3. 안전/정책 기반 [P0]

- [ ] `lib/safety` — untrusted 입력 전처리기 인터페이스
- [ ] `lib/safety` — 지시성 문장 격리 기본 구현
- [ ] `lib/policies` — 액션 등급 판정 함수
- [ ] `lib/logging` — 감사/위반 로그 쓰기 헬퍼

## 4. 오케스트레이터 [P1]

- [ ] `lib/orchestrator` — 인텐트 분류 스캐폴드
- [ ] LLM 공급자 어댑터 결정 및 `lib/integrations/llm` 추가
- [ ] `/api/assistant` Route Handler (얇게)

## 5. 문서 기능 [P1]

- [ ] 업로드 UI + `/api/documents` POST
- [ ] 텍스트 추출 전략 결정 (PDF/DOCX/…)
- [ ] 요약 엔드포인트 + `lib/documents.summarize`
- [ ] 비교 엔드포인트 + `lib/documents.compare`

## 6. 메모 기능 [P1]

- [ ] 메모 리스트/상세 UI
- [ ] `/api/memos` GET/POST/PATCH
- [ ] 메모 요약/검색 (간단 텍스트 검색부터)

## 7. 캘린더 기능 [P1]

- [ ] Google Calendar OAuth 연결 (최소 스코프)
- [ ] `/api/calendar/events` 읽기
- [ ] 일정 제안 오케스트레이션
- [ ] 승인 → 생성 플로우 (`/api/approvals/[id]/confirm` 경유)

## 8. 메일 기능 [P1]

- [ ] Gmail OAuth 연결 (읽기 스코프)
- [ ] 스레드 목록/단건 조회
- [ ] 요약
- [ ] 답장 초안 생성 (저장만, **발송 없음**)

## 9. 보조 기능 [P2]

- [ ] 웹 검색 공급자 선택 + `/api/search`
- [ ] 날씨 공급자 선택 + `/api/weather`

## 10. 승인 UX [P1]

- [ ] 승인 카드 컴포넌트
- [ ] `/api/approvals` 목록/단건/confirm/reject
- [ ] 실행 후 `execution_log` 렌더링

## 11. 관측/품질 [P2]

- [ ] 서버 에러 로깅 경로
- [ ] 기본 유닛 테스트 프레임 결정
- [ ] 핵심 경로 통합 테스트

## 12. 배포 [P2]

- [ ] Vercel 프로젝트 연결
- [ ] 환경 변수 동기화
- [ ] 프리뷰/프로덕션 브랜치 전략

---

## Blocked / 보류 [BLOCKED]

- 메일 발송 기능 — 정책 재설계 필요
- 어떤 종류의 삭제 기능 — 정책 재설계 필요
- 자동 장기 기억 — 현재 범위 밖 (해제 시 `out-of-scope.md` 선개정)
- 로그인된 웹사이트 자동 조작 — 범위 밖
