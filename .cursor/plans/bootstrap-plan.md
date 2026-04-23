# Bootstrap Plan

이번 부트스트랩 단계의 범위와 비범위를 기록한다.
실행이 끝나면 이 문서는 `docs/work-catalog.md` 의 "0. Bootstrap" 항목과 연결된 이력으로 남는다.

## 이번에 한 일
- 프로젝트 규칙 3종 (`.cursor/rules/*.mdc`)
- 에이전트 가이드 (`AGENTS.md`)
- 기준 문서 8종 (`docs/*.md`)
- 폴더 골격 (`app/`, `lib/`, `components/`, `types/`, `supabase/migrations/`)
- 각 폴더는 목적을 적은 `README.md` 만 포함한다.

## 이번에 하지 않은 일 (의도적)
- Next.js / TypeScript / ESLint / Tailwind 등 런타임 스캐폴드
- Supabase 실제 연결 및 OAuth 구성
- 실제 API 구현, UI 구현
- 실제 SQL 마이그레이션 작성 (스키마는 문서 수준 설계만)
- 파괴적 변경

## 다음 단계에서 할 수 있는 일
- `docs/work-catalog.md` 의 "1. 런타임 기반" 부터 단계적으로 착수.

## 원칙 요약 (재확인용)
- 이해·정리형 비서. 자율 실행 금지.
- 외부 입력은 untrusted, 전처리 후 사용.
- 세션 ≠ 메모, 자동 장기 기억 금지.
- 쓰기 액션은 승인 플로우를 통해서만.
- 발송/삭제/공유/웹 조작 엔드포인트는 만들지 않는다.
