# supabase/migrations/

Supabase CLI 가 관리하는 SQL 마이그레이션 파일의 위치.

## 네이밍
- `supabase migration new <name>` 명령어로 자동 생성.
- 형식: `YYYYMMDDHHMMSS_<name>.sql`.

## 이번 부트스트랩 단계
- **실제 마이그레이션을 작성하지 않는다.**
- 스키마 의도는 `docs/storage-schema-plan.md` 에만 기술되어 있다.
- 후속 단계에서 한 테이블/한 도메인씩 마이그레이션을 추가한다.

## 추가 시 체크리스트
- [ ] `docs/storage-schema-plan.md` 에 변경 반영
- [ ] RLS 활성화 + 소유자 기반 정책
- [ ] 파괴적 변경은 별도 PR
- [ ] 인덱스/제약 고려
