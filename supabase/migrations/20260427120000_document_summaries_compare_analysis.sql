-- 비교(comparison)·분석(analysis) 결과를 document_summaries 에 저장할 수 있게 확장한다.
-- content 상한은 구조화 JSON 문자열을 수용하도록 완화한다.

alter table public.document_summaries drop constraint if exists document_summaries_summary_type_check;
alter table public.document_summaries add constraint document_summaries_summary_type_check
  check (summary_type in ('summary', 'comparison', 'analysis'));

alter table public.document_summaries drop constraint if exists document_summaries_content_check;
alter table public.document_summaries add constraint document_summaries_content_check
  check (char_length(content) between 1 and 32000);

comment on constraint document_summaries_summary_type_check on public.document_summaries is
  'summary: 문서 요약(문서당 1). comparison: 다문서 비교(주 문서 document_ids[0] 에 귀속 UPSERT). analysis: 단일 문서 해석(문서당 1).';
