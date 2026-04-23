# lib/orchestrator/

자연어 요청을 받아 어떤 도메인 모듈을 호출할지 결정하고, 결과를 합친다.

책임:
- 인텐트 분류 (요약, 비교, 일정 제안, 메모 저장 등).
- 도메인 모듈로 위임 (`documents`, `mail`, `calendar`, `memos`).
- 응답 형식 일관성 유지.

제약:
- 직접 I/O 하지 않는다. DB/외부 API 접근은 도메인 모듈 또는 integrations에 맡긴다.
- 실행 계열 액션은 **직접 실행하지 않고** `pending_actions` 를 만들어 승인 플로우로 돌린다.
- 외부 입력은 `lib/safety` 전처리를 통과한 것만 받는다.

TODO: handle(), intent classifier, response composer.
