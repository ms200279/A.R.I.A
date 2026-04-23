# AGENTS.md — aria

이 문서는 이 저장소에서 코드를 작성하는 에이전트(Cursor, 다른 AI 도구, 사람 개발자)에게 주는 1차 브리프다.
세부 규칙은 `.cursor/rules/*.mdc` 와 `docs/` 아래 문서를 참조한다.

## 이 프로젝트는 무엇인가
- 이름: **aria**
- 한 줄 정의: 문서/메일/캘린더/메모를 읽고 정리해주는 **이해·정리형 개인 비서**.
- 보조 기능: 웹 검색, 날씨.
- 자율 실행형 에이전트 아님. 실행은 항상 사용자 승인을 거친다.

## 무엇을 해도 되는가
- 읽기, 요약, 비교, 분석, 초안 작성, 일정 제안.
- 사용자가 명시적으로 저장을 요청한 메모 저장.
- 승인된 캘린더 이벤트 생성.

## 무엇을 하면 안 되는가
- 메일 자동 발송, 삭제, 외부 공유.
- 로그인된 웹사이트 자동 조작.
- 자동 장기 기억 / 자동 사실 추출 저장.
- 세션 컨텍스트와 메모 저장소 병합.
- 외부 입력(문서·메일·웹) 원문을 핵심 프롬프트에 그대로 주입.

자세한 목록은 `docs/out-of-scope.md` 참조.

## 기술 스택
- Next.js (App Router) + TypeScript
- Supabase (Postgres, Auth, Storage, RLS)
- Vercel 배포
- Cursor 기반 개발

## 레이어 한눈에 보기
- `app/` — UI 페이지 + Route Handlers (얇게 유지)
- `lib/` — 도메인/정책/안전/로깅/통합 로직
- `components/` — 공용 UI
- `types/` — 공용 타입
- `supabase/` — 마이그레이션, 설정

자세한 구조는 `docs/architecture.md` 참조.

## 새로운 기능을 추가할 때
1. `docs/scope.md` 에 맞는지 확인한다.
2. 쓰기 계열이면 `docs/action-policy.md` 의 어떤 카테고리인지 정한다.
3. `docs/api-map.md` 에 엔드포인트를 먼저 기술한다.
4. 필요한 경우 `docs/storage-schema-plan.md` 를 갱신한다.
5. 구현은 `lib/<도메인>` 에서 먼저, `app/api/<도메인>` 는 얇게.

## 참고해야 할 규칙
- `.cursor/rules/project-architecture.mdc`
- `.cursor/rules/product-policy.mdc`
- `.cursor/rules/workflow.mdc`
