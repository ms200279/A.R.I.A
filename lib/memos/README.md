# lib/memos/

메모 도메인 로직.

원칙:
- 사용자가 **명시적으로** 저장을 요청한 경우에만 `memos` 레코드를 생성한다.
- 자동 수집/자동 기억 파이프라인을 만들지 않는다.
- 메모 본문은 사용자 자신의 저장이므로 trusted 로 취급 가능하지만, 외부 검색 결과로 LLM에 다시 넣을 때는 일반 컨텍스트 규칙을 따른다.

TODO: create, list, getById, update, summarize, search.
