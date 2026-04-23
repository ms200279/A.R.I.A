-- 비교 결과 히스토리 및 문서 N개 앵커(조인).
-- document_summaries(summary_type=comparison) 는 primary 문서 기준 최신 스냅샷 UPSERT 로 유지(호환).
-- comparison_histories 는 비교 실행마다 append 되며, 참여 문서 전부는 comparison_history_documents 에 저장된다.

-- ============================================================
-- comparison_histories
-- ============================================================
create table if not exists public.comparison_histories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_id uuid references public.document_summaries(id) on delete set null,
  primary_document_id uuid not null references public.documents(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 32000),
  source_ranges jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comparison_histories_user_created_idx
  on public.comparison_histories (user_id, created_at desc);

create index if not exists comparison_histories_summary_idx
  on public.comparison_histories (summary_id)
  where summary_id is not null;

comment on table public.comparison_histories is
  '다문서 비교 실행 단위. content 는 해당 시점 스냅샷. summary_id 는 document_summaries UPSERT 행과 연결(삭제 시 null).';

-- ============================================================
-- comparison_history_documents (앵커 / 참여 문서)
-- ============================================================
create table if not exists public.comparison_history_documents (
  id uuid primary key default gen_random_uuid(),
  comparison_history_id uuid not null references public.comparison_histories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  anchor_role text not null default 'peer'
    check (anchor_role in ('primary', 'peer')),
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (comparison_history_id, document_id)
);

create index if not exists comparison_history_documents_document_user_idx
  on public.comparison_history_documents (document_id, user_id);

create index if not exists comparison_history_documents_history_idx
  on public.comparison_history_documents (comparison_history_id);

comment on table public.comparison_history_documents is
  '한 번의 비교에 포함된 문서들. primary 는 document_summaries.comparison 행이 귀속되는 문서.';

-- ============================================================
-- RLS
-- ============================================================
alter table public.comparison_histories enable row level security;
alter table public.comparison_history_documents enable row level security;

drop policy if exists "comparison_histories_select_own" on public.comparison_histories;
create policy "comparison_histories_select_own" on public.comparison_histories
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "comparison_history_documents_select_own" on public.comparison_history_documents;
create policy "comparison_history_documents_select_own" on public.comparison_history_documents
  for select
  to authenticated
  using (user_id = auth.uid());

-- 쓰기: 서버 service_role 경유를 전제(기존 document_summaries 와 동일).

drop trigger if exists comparison_histories_touch_updated_at on public.comparison_histories;
create trigger comparison_histories_touch_updated_at
  before update on public.comparison_histories
  for each row execute procedure public.touch_updated_at();
