/**
 * 액션/승인/감사 관련 공용 타입.
 * lib/policies 와 app/api/approvals 에서 함께 사용한다.
 */

export type ActionTier = "read" | "suggest" | "create_low_risk" | "create_approval" | "sensitive";

/**
 * 앱 내부에서 오가는 액션 추상.
 * 구체 액션은 kind + payload 조합으로 구분한다.
 */
export type AppAction =
  | { kind: "memo.create"; payload: { body: string; tags?: string[] } }
  | { kind: "memo.update"; payload: { id: string; body?: string; tags?: string[] } }
  | { kind: "document.summarize"; payload: { documentId: string } }
  | { kind: "document.compare"; payload: { documentIds: string[] } }
  | { kind: "mail.summarize"; payload: { threadId: string } }
  | { kind: "mail.draft_reply"; payload: { threadId: string; prompt?: string } }
  | { kind: "calendar.propose"; payload: { goal: string; windowDays?: number } }
  | { kind: "calendar.create_from_approval"; payload: { approvalId: string } }
  | { kind: "search.web"; payload: { query: string } }
  | { kind: "weather.current"; payload: { location?: string } };

export type EvaluateResult =
  | { allow: true; requireApproval: false; tier: ActionTier }
  | { allow: true; requireApproval: true; tier: ActionTier }
  | { allow: false; reason: string; tier: ActionTier };

/**
 * 승인 대기 레코드의 앱 측 표현. DB 스키마와는 별개.
 */
export type PendingAction = {
  id: string;
  userId: string;
  action: AppAction;
  status: "pending" | "confirmed" | "rejected" | "expired";
  createdAt: string;
};
