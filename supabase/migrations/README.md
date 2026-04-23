# supabase/migrations/

Supabase CLI가 관리하는 SQL 마이그레이션 파일의 위치.

- 파일 네이밍은 Supabase CLI 기본(`YYYYMMDDHHMMSS_<name>.sql`) 규칙을 따른다.
- 이번 부트스트랩 단계에서는 **실제 마이그레이션을 작성하지 않는다.**
- 각 마이그레이션은 `docs/storage-schema-plan.md` 변경과 함께 추가한다.

## 추가 시 체크리스트
- [ ] 관련 테이블/컬럼/인덱스가 `storage-schema-plan.md` 에 반영되었는가
- [ ] RLS를 활성화하고 소유자 기반 정책을 넣었는가
- [ ] 위험한 변경(drop, 데이터 이동)은 별도 PR로 분리했는가
