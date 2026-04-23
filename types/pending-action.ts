/**
 * pending_actions 테이블과 1:1 매핑되는 타입.
 * action_type 이 늘어나면 payload 타입도 함께 확장한다.
 */

import type { MemoSourceType } from "./memo";

export type PendingActionStatus =
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "blocked";

export type ActionType = "save_memo";
export type TargetType = "memo";

export type SaveMemoPayload = {
  title: string | null;
  content: string;
  source_type: MemoSourceType;
  project_key: string | null;
};

export type PendingActionResult =
  | { kind: "memo_saved"; memo_id: string }
  | { kind: "rejected" }
  | { kind: "blocked"; reason: string };

export type PendingAction<TPayload = unknown> = {
  id: string;
  user_id: string;
  action_type: ActionType;
  target_type: TargetType;
  status: PendingActionStatus;
  payload: TPayload;
  sensitivity_flag: boolean;
  blocked_reason: string | null;
  result: PendingActionResult | null;
  created_at: string;
  updated_at: string;
};

export type SaveMemoPending = PendingAction<SaveMemoPayload>;

/** 목록 UI 용: 종료된 save_memo pending 행(감사·히스토리). */
export type SaveMemoPendingOutcome = {
  id: string;
  status: "executed" | "rejected" | "blocked";
  payload: SaveMemoPayload;
  blocked_reason: string | null;
  result: unknown;
  created_at: string;
  updated_at: string;
};
