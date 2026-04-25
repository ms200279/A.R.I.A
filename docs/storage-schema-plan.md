# Storage Schema Plan

> 상태: DRAFT — 실제 SQL은 아직 작성하지 않는다.
> 이 문서는 **테이블의 의도와 경계**만 정의한다. 마이그레이션은 별도 단계에서 추가한다.

## 저장 원칙

- 원본 바이너리/대용량 텍스트 → **Supabase Storage**
- 메타데이터, 상태, 관계 → **Postgres**
- 모든 사용자 데이터 테이블은 **RLS 활성화**, `user_id = auth.uid()` 기본 정책.
- 세션과 메모는 **별도 테이블** (절대 합치지 않음).
- 초안 / 승인 대기 / 실행 로그는 **별도 테이블**.

## 테이블 골격 (초안)

### 인증/사용자

- `profiles`
  - Supabase Auth 사용자와 1:1, 표시 이름 등.

### 문서

- `documents`
  - 메타데이터: 제목, 원본 파일 storage path, mime, size, 업로드 시각, 소유자.
- `document_chunks` _(필요 시)_
  - 청크 텍스트, 위치, 선택적 임베딩(pgvector).

### 메모

- `memos`
  - 본문, `source_type`/`project_key`/`tags`(read-side, text[]), `pinned`·`bookmarked`(read-side), 생성/수정 시각, 소유자.
  - **사용자가 명시적으로 저장한 것만** 들어감(자동 장기기억 아님). 일반 RLS 쓰기 없음(승인 확정·요약·read-side API 가 service_role 등으로 갱신).

### 메일 (읽기 중심)

- `mail_accounts`
  - 연결된 메일 계정 메타, OAuth 토큰은 별도 보안 저장소 (이 테이블에 평문 금지).
- `mail_messages_cache` _(선택)_
  - 자주 참조하는 메일의 요약/메타 캐시. 원문은 저장하지 않거나 짧은 보존.

### 캘린더

- `calendar_accounts`
  - 연결된 캘린더 계정 메타.
- `calendar_events_cache` _(선택)_
  - 표시에 필요한 최소 필드 캐시.

### 대화 / 세션

- `sessions`
  - 대화 세션 단위.
- `session_messages`
  - 메시지 로그. 외부 입력의 원문은 여기에 적재하지 않고 포인터/요약만.

### 제안 / 승인 / 실행

- `drafts`
  - LLM이 만든 초안(메일 답장, 일정 제안, 메모 초안 등).
- `pending_actions`
  - 승인 대기 중인 실행 요청. 액션 타입, 대상, 파라미터, 상태.
- `execution_log`
  - 실제 수행된 쓰기 액션의 결과 / 외부 시스템 응답 요약.

### 감사 / 정책

- `audit_log`
  - 쓰기 액션 전반의 감사 추적.
- `policy_violation_log`
  - 정책 차단 이벤트.

## Storage 버킷 (초안)

- `documents/` — 원본 파일. 소유자별 경로 격리.
- (필요 시) `exports/` — 사용자 내보내기 결과.

### `comparison_history_documents.anchor_role`

- `text` + check `in ('primary','peer','secondary')`. 앱 DTO `ComparisonAnchorRole`·`lib/documents/comparison-anchor-role` 와 맞출 것; 비정규 값은 read-side에서 `null`+개발 경고.

### 비교 북마크 (내부 재참조)

- `comparison_bookmarks` — `user_id`, `comparison_id` (FK `comparison_histories`, ON DELETE CASCADE), 선택 `label`, `created_at`, `UNIQUE(user_id, comparison_id)`. RLS: 본인 행만. 외부 공개 공유·guest 토큰과 무관.

## 금지

- 하나의 테이블에 세션 메시지와 메모를 함께 넣는 설계.
- OAuth 토큰/비밀키를 일반 테이블에 평문 저장.
- 외부 입력 원문을 그대로 `session_messages` 등 핫 경로에 적재.

## TODO

- [ ] 각 테이블의 컬럼/인덱스 확정
- [ ] RLS 정책 문구 초안
- [ ] 마이그레이션 파일 생성 전략 (`supabase/migrations/` 네이밍 규칙)
- [ ] 토큰 저장소 방식 결정 (Vault / 서버 사이드 KMS 등)
