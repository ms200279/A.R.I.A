# types/

공용 타입 정의.

가이드:
- 여러 모듈이 공유하는 타입만 이곳에 둔다.
- 도메인 내부 전용 타입은 해당 `lib/<domain>/types.ts` 에 둔다.
- Supabase 생성 타입은 `types/supabase.ts` 같이 전용 파일로 분리 (자동 생성 대상).

TODO: ActionTier, PendingAction, AuditLogEntry, UntrustedSource 등.
