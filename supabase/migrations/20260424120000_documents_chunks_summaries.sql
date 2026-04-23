-- documents, document_chunks, document_summaries
-- RLS: 본인 SELECT만. 쓰기는 service_role(서버) 경유를 전제로 한다.

-- ============================================================
-- documents
-- ============================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  storage_path text,
  mime_type text,
  parsed_text text,
  status text not null default 'active'
    check (status in ('active', 'processing', 'failed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_updated_idx
  on public.documents (user_id, updated_at desc);

alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
  for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- document_chunks (우선 소스; 없으면 documents.parsed_text)
-- ============================================================
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null check (char_length(content) between 1 and 200000),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_idx
  on public.document_chunks (document_id, chunk_index);

alter table public.document_chunks enable row level security;

drop policy if exists "document_chunks_select_own" on public.document_chunks;
create policy "document_chunks_select_own" on public.document_chunks
  for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- document_summaries
-- 정책: summary_type='summary' 는 문서당 1행(유니크). 재요약 시 UPSERT 로 덮어쓴다.
--       created_at 은 최초 생성, updated_at 은 마지막 요약 시각.
-- ============================================================
create table if not exists public.document_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_type text not null default 'summary'
    check (summary_type = 'summary'),
  content text not null check (char_length(content) between 1 and 10000),
  source_ranges jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, summary_type)
);

create index if not exists document_summaries_document_idx
  on public.document_summaries (document_id, updated_at desc);

alter table public.document_summaries enable row level security;

drop policy if exists "document_summaries_select_own" on public.document_summaries;
create policy "document_summaries_select_own" on public.document_summaries
  for select
  to authenticated
  using (user_id = auth.uid());

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute procedure public.touch_updated_at();

drop trigger if exists document_summaries_touch_updated_at on public.document_summaries;
create trigger document_summaries_touch_updated_at
  before update on public.document_summaries
  for each row execute procedure public.touch_updated_at();
