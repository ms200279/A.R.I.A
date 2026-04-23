-- documents 업로드 파이프라인 보강 (이미 20260425120000 적용 후 실행)
-- - 컬럼 설명(대시보드/SQL 에디터 가독성)
-- - document_chunks.token_count 음수 방지

-- ============================================================
-- documents: 컬럼 코멘트
-- ============================================================
comment on column public.documents.file_name is '업로드 시 원본 파일명';
comment on column public.documents.file_type is '정규화된 MIME (예: text/plain, text/markdown)';
comment on column public.documents.file_size is '바이트 단위 크기';
comment on column public.documents.sha256_hash is '원본 바이트 SHA-256 (hex)';
comment on column public.documents.parsing_status is
  '텍스트 추출: pending | in_progress | complete | failed | unsupported_format | blocked';
comment on column public.documents.preprocessing_status is
  '비신뢰 전처리·청킹: pending | in_progress | complete | failed | blocked';
comment on column public.documents.summary_status is
  '요약 파이프라인: none | pending | in_progress | ready | failed';
comment on column public.documents.parsing_error_code is
  '실패·차단 시 앱 정의 코드 (예: unsupported_format, empty_after_preprocess)';

-- ============================================================
-- document_chunks: 컬럼 코멘트 + 검증
-- ============================================================
comment on column public.document_chunks.token_count is '근사 토큰 수(옵션); 요약/과금 참고용';
comment on column public.document_chunks.page_number is '원본 페이지 번호(옵션); PDF 등 확장용';
comment on column public.document_chunks.section_label is '섹션 라벨(옵션); 구조화 파서 확장용';

alter table public.document_chunks
  drop constraint if exists document_chunks_token_count_non_negative;

alter table public.document_chunks
  add constraint document_chunks_token_count_non_negative
  check (token_count is null or token_count >= 0);
