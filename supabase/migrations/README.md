# supabase/migrations/

Supabase가 순서대로 적용하는 SQL 마이그레이션. 파일명: `YYYYMMDDHHMMSS_<name>.sql`.

- 새 마이그레이션: `supabase migration new <name>` (루트에서 실행).
- 스키마 의도·변경 요약: `docs/storage-schema-plan.md` 를 함께 갱신한다.

## 체크리스트 (추가 시)

- [ ] `docs/storage-schema-plan.md` 반영
- [ ] RLS / 소유자 정책(해당 시)
- [ ] 파괴적 변경은 별도 PR
- [ ] 인덱스·제약 고려

## 원격 DB에 반영하는 방법

프로젝트 루트 `supabase/README.md` 의 **「지금 반드시 적용이 필요한 마이그레이션」** 및 **`supabase db push` / SQL Editor** 절을 참고한다.
