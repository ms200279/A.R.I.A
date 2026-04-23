-- memos & pending_actions: 첫 승인형 쓰기 흐름을 위한 최소 스키마.
-- 정책 요약:
--   * 일반 사용자는 memos / pending_actions 에 직접 INSERT/UPDATE/DELETE 할 수 없다.
--   * 조회(SELECT)는 본인 소유 행으로 제한된다.
--   * 쓰기는 전적으로 서버(service_role)가 pending_actions 상태 전이를 거쳐 수행한다.

-- ============================================================
-- memos
-- ============================================================
create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text not null check (char_length(content) between 1 and 50000),
  summary text,
  source_type text not null default 'quick_capture'
    check (source_type in ('quick_capture', 'chat', 'import')),
  project_key text,
  sensitivity_flag boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memos_user_created_idx
  on public.memos (user_id, created_at desc);

create index if not exists memos_search_idx
  on public.memos
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || content));

alter table public.memos enable row level security;

-- 본인 행만 조회 가능.
drop policy if exists "memos_select_own" on public.memos;
create policy "memos_select_own" on public.memos
  for select
  to authenticated
  using (user_id = auth.uid());

-- 쓰기 정책은 의도적으로 제공하지 않는다. (service_role 경유만 허용)

-- ============================================================
-- pending_actions
-- ============================================================
create table if not exists public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null
    check (action_type in ('save_memo')),
  target_type text not null
    check (target_type in ('memo')),
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'approved', 'rejected', 'executed', 'blocked')),
  payload jsonb not null,
  sensitivity_flag boolean not null default false,
  blocked_reason text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pending_actions_user_status_idx
  on public.pending_actions (user_id, status, created_at desc);

alter table public.pending_actions enable row level security;

drop policy if exists "pending_actions_select_own" on public.pending_actions;
create policy "pending_actions_select_own" on public.pending_actions
  for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- updated_at 트리거
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memos_touch_updated_at on public.memos;
create trigger memos_touch_updated_at
  before update on public.memos
  for each row execute procedure public.touch_updated_at();

drop trigger if exists pending_actions_touch_updated_at on public.pending_actions;
create trigger pending_actions_touch_updated_at
  before update on public.pending_actions
  for each row execute procedure public.touch_updated_at();
