import AssistantShell from "@/components/assistant/AssistantShell";

/**
 * 대시보드 홈 (`/`).
 *
 * 이 화면은 "assistant 홈" 이다. 제품 메인 화면에 해당하며,
 * 사용자가 처음 들어왔을 때 가장 먼저 보게 되는 화면이다.
 *
 * 구성은 client 쪽 AssistantShell 이 전담한다:
 *   - 파티클 구 (상태 반응 visual)
 *   - 메시지 리스트
 *   - 하단 sticky 입력창
 *
 * /api/assistant/query 와 연결된다. 백엔드가 읽기 도구만 있어도 답변은 나오고,
 * 저장 의도는 pending_actions 경유로 안전하게 처리된다.
 */
export default function DashboardHome() {
  return <AssistantShell />;
}
