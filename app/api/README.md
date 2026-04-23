# app/api/

Route Handlers. 얇게 유지한다.

공통 규칙:
- 인증 확인 → 입력 검증 → `lib/<domain>` 호출 → 응답.
- 쓰기 계열은 `lib/policies.evaluate()` 를 반드시 통과.
- 외부 입력을 다루는 경로는 `lib/safety` 경유.
- 성공/실패 시 `lib/logging` 으로 감사 로그.

상세 매핑은 `docs/api-map.md` 참조.
