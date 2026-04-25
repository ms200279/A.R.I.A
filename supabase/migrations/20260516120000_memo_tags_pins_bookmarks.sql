-- read-side 편의: 태그·핀·북마크( 승인 흐름과 무관, user 소유 행만 ).
-- 쓰기는 앱 API( service role 또는 전용 RLS)에서만.

alter table public.memos
  add column if not exists tags text[] not null default '{}',
  add column if not exists pinned boolean not null default false,
  add column if not exists bookmarked boolean not null default false;

-- 태그·project_key 는 이미 to_tsvector 인덱스에 포함될 수 있음; read 트래픽에 맞는 보조 인덱스
create index if not exists memos_user_pinned_updated_idx
  on public.memos (user_id, pinned desc, bookmarked desc, updated_at desc);

comment on column public.memos.tags is '소유자 지정 짧은 태그( read-side, 저작 승인과 독립).';
comment on column public.memos.pinned is '목록 상단 고정( read-side).';
comment on column public.memos.bookmarked is '북마크( read-side).';
