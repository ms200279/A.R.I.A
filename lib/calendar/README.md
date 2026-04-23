# lib/calendar/

캘린더 도메인 로직.

제공 예정 기능:
- 이벤트 조회.
- 일정 제안 (슬롯 추천).
- 승인된 `pending_action` 기반 이벤트 생성.

제약:
- 생성은 **승인 플로우를 통해서만** 호출된다. 오케스트레이터가 직접 생성 함수를 부르지 않는다.
- 삭제/수정 함수는 현재 단계에서 만들지 않는다.

TODO: listEvents, proposeSlots, createFromApproval.
