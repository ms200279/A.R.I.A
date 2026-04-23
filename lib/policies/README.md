# lib/policies/

액션 등급 판정 및 승인 필요 여부 결정.

책임:
- 액션 입력(타입, 대상, 파라미터)을 받아 `Read | Suggest | Create(low-risk) | Create(approval) | Sensitive` 로 분류.
- Sensitive 는 기본적으로 차단. 해제하려면 별도 설정/플로우가 있어야 한다.
- 차단 시 `lib/logging` 으로 policy violation 기록.

제공 예정 API (초안):
- `classify(action) -> ActionTier`
- `evaluate(action, context) -> { allow: boolean, requireApproval: boolean, reason?: string }`

근거 문서:
- `docs/action-policy.md` (이 문서와 코드가 1:1 로 동기화)

TODO: 타입 정의, 기본 분류 테이블, 테스트.
