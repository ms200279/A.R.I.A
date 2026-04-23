# supabase/

Supabase CLI가 관리하는 마이그레이션 및 설정.

- `config.toml` — `supabase init` 으로 생성됨. 로컬 개발 서버(54321/54322/...) 포트와 각 서비스 설정을 관리.
- `migrations/` — 실제 SQL 마이그레이션. 이번 부트스트랩 단계에서는 파일을 만들지 않는다.
- `.gitignore` — `.branches`, `.temp`, `.env.keys`, `.env.*.local` 등 무시.

## 이미 완료된 것
- Supabase CLI 설치 및 `supabase init` 실행.

## 원격 Supabase 프로젝트 링크 (수행 필요)
```bash
# 1) 프로젝트 ref 를 .env.local 또는 셸에 설정
export SUPABASE_PROJECT_REF=<your-project-ref>

# 2) 링크 (대화형으로 DB 비밀번호 입력)
supabase link --project-ref $SUPABASE_PROJECT_REF

# 3) 원격 스키마 가져오기 (이미 테이블이 있다면)
# supabase db pull
```

## 마이그레이션 추가 규칙
- 파일 네이밍: `supabase migration new <name>` 로 자동 생성 (`YYYYMMDDHHMMSS_<name>.sql`).
- 각 마이그레이션은 `docs/storage-schema-plan.md` 갱신과 함께 추가한다.

## 체크리스트 (마이그레이션 추가 시)
- [ ] 관련 테이블/컬럼/인덱스가 `storage-schema-plan.md` 에 반영되었는가
- [ ] RLS 를 활성화하고 소유자 기반 정책을 넣었는가
- [ ] 파괴적 변경(drop, 데이터 이동)은 별도 PR로 분리했는가
