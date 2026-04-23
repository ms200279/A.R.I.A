-- 문서 업로드 파이프라인용 스키마 보강 + Storage 버킷
-- 기존 documents / document_chunks 가 이미 있으면 ADD COLUMN 만 수행한다.

-- ============================================================
-- documents: 업로드·파싱·전처리·요약 파이프라인 상태
-- ============================================================
alter table public.documents add column if not exists file_name text;
alter table public.documents add column if not exists file_type text;
alter table public.documents add column if not exists file_size bigint;
alter table public.documents add column if not exists sha256_hash text;

alter table public.documents add column if not exists parsing_status text;
alter table public.documents add column if not exists preprocessing_status text;
alter table public.documents add column if not exists summary_status text;
alter table public.documents add column if not exists parsing_error_code text;

update public.documents
set
  parsing_status = coalesce(parsing_status, 'pending'),
  preprocessing_status = coalesce(preprocessing_status, 'pending'),
  summary_status = coalesce(summary_status, 'none')
where parsing_status is null
   or preprocessing_status is null
   or summary_status is null;

alter table public.documents alter column parsing_status set default 'pending';
alter table public.documents alter column preprocessing_status set default 'pending';
alter table public.documents alter column summary_status set default 'none';

-- 신규 행에 대한 체크 (기존 행은 이미 다양한 status 값을 가질 수 있음)
alter table public.documents drop constraint if exists documents_parsing_status_check;
alter table public.documents add constraint documents_parsing_status_check
  check (
    parsing_status is null
    or parsing_status in (
      'pending',
      'in_progress',
      'complete',
      'failed',
      'unsupported_format',
      'blocked'
    )
  );

alter table public.documents drop constraint if exists documents_preprocessing_status_check;
alter table public.documents add constraint documents_preprocessing_status_check
  check (
    preprocessing_status is null
    or preprocessing_status in (
      'pending',
      'in_progress',
      'complete',
      'failed',
      'blocked'
    )
  );

alter table public.documents drop constraint if exists documents_summary_status_check;
alter table public.documents add constraint documents_summary_status_check
  check (
    summary_status is null
    or summary_status in ('none', 'pending', 'in_progress', 'ready', 'failed')
  );

create index if not exists documents_user_parsing_idx
  on public.documents (user_id, parsing_status, updated_at desc);

-- ============================================================
-- document_chunks: 메타 컬럼
-- ============================================================
alter table public.document_chunks add column if not exists token_count int;
alter table public.document_chunks add column if not exists page_number int;
alter table public.document_chunks add column if not exists section_label text;

-- ============================================================
-- Storage: documents 버킷 (서버 service_role 업로드; 클라이언트 직접 업로드 시 정책용)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit;

drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
