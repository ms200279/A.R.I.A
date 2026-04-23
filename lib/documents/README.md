# lib/documents/

문서 도메인 로직.

제공 예정 기능:

- 업로드 처리 (Storage 경로 결정, 메타 저장).
- 본문 추출 / 청크화.
- 요약, 비교, 분석.

외부 입력 규칙:

- 문서 본문은 untrusted. `lib/safety.prepareUntrusted` 통과 후 LLM에 전달.

TODO: types, extract, summarize, compare.
