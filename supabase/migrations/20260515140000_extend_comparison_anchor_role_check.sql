-- 비교 앵커 역할: secondary 등 확장(기존 primary/peer 행·읽기 경로 그대로).

alter table public.comparison_history_documents
  drop constraint if exists comparison_history_documents_anchor_role_check;

alter table public.comparison_history_documents
  add constraint comparison_history_documents_anchor_role_check
  check (anchor_role in ('primary', 'peer', 'secondary'));

comment on column public.comparison_history_documents.anchor_role is
  '앵커 역할. primary=요약 upsert 앵커, peer/secondary=다른 참가 문서(secondary 는 다단계·그룹화 확장용).';
