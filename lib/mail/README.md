# lib/mail/

메일 도메인 로직 (읽기 중심).

제공 예정 기능:
- 스레드/메일 조회 (캐시 활용 여부 설계 필요).
- 요약.
- 답장 초안 생성 → `drafts` 테이블 저장만.

절대 금지:
- 메일 발송 함수를 이 모듈에 만들지 않는다.
- 삭제 함수를 만들지 않는다.

외부 입력 규칙:
- 메일 본문은 untrusted. `lib/safety` 경유 필수.

TODO: listThreads, getThread, summarize, draftReply.
