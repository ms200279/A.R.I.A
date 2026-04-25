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

---

## 지금 반드시 적용이 필요한 마이그레이션 (메모 read-side)

앱 코드(`lib/memos/memo-columns.ts` 등)가 `memos.tags`, `memos.pinned`, `memos.bookmarked` 를 가정한다. **원격 DB에 아래 파일이 아직 반영되지 않았다면** 메모 API·목록이 실패할 수 있다.

| 파일 | 하는 일 |
|------|---------|
| `migrations/20260516120000_memo_tags_pins_bookmarks.sql` | `memos` 에 `tags text[]`, `pinned`, `bookmarked` 컬럼 추가 + `memos_user_pinned_updated_idx` 인덱스 + 컬럼 코멘트 |

`if not exists` / `add column if not exists` 이므로 **이미 수동으로 같은 스키마가 있다면** 중복 추가 없이 스킵된다.

### 적용 방법 (본인이 수행)

**A. Supabase CLI — 링크된 원격 프로젝트에 푸시 (권장)**

```bash
cd /path/to/aria
# 한 번만: supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
```

`db push` 는 로컬 `migrations/` 중 아직 원격 `supabase_migrations.schema_migrations` 에 없는 것만 적용한다.

**B. Supabase Dashboard — SQL Editor**

1. [Project] → **SQL Editor** → New query  
2. `migrations/20260516120000_memo_tags_pins_bookmarks.sql` **전체**를 복사해 실행  
3. 에러 없이 끝나면 완료

**C. 로컬 전용 `supabase start` 를 쓰는 경우**

```bash
supabase db reset   # 로컬 DB를 초기화하고 모든 migration 순서대로 적용 (데이터 날아감)
# 또는
supabase migration up
```

### 적용 후 확인 (SQL)

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'memos'
  and column_name in ('tags', 'pinned', 'bookmarked');
```

세 행이 보이면 된다.
