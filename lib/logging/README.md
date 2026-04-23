# lib/logging/

감사 / 정책 위반 / 실행 로그 쓰기 헬퍼.

책임:
- `audit_log` — 쓰기 액션의 감사 추적.
- `policy_violation_log` — 차단 이벤트.
- `execution_log` — 외부 시스템 호출 결과 요약.

제약:
- 원문을 그대로 저장하지 않는다. 요약/해시/포인터만.
- 토큰/시크릿을 로그에 남기지 않는다.

TODO: writer 함수 시그니처, 테이블 매핑.
