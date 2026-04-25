-- 로그인 사용자의 비교 히스토리 내부 북마크(재참조). 외부 공개 공유/토큰 없음.

create table if not exists public.comparison_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  comparison_id uuid not null references public.comparison_histories (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  constraint comparison_bookmarks_user_comparison_unique unique (user_id, comparison_id)
);

create index if not exists comparison_bookmarks_user_created_idx
  on public.comparison_bookmarks (user_id, created_at desc);

comment on table public.comparison_bookmarks is
  '사용자가 나중에 다시 찾기 위해 표시한 비교 히스토리(내부 전용, 공개 링크 아님).';

alter table public.comparison_bookmarks enable row level security;

create policy "comparison_bookmarks_select_own"
  on public.comparison_bookmarks for select
  using (user_id = auth.uid());

create policy "comparison_bookmarks_insert_own"
  on public.comparison_bookmarks for insert
  with check (user_id = auth.uid());

create policy "comparison_bookmarks_delete_own"
  on public.comparison_bookmarks for delete
  using (user_id = auth.uid());
