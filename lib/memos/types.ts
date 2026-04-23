import "server-only";

import type { MemoSourceType } from "@/types/memo";

export type CreateMemoInput = {
  content: string;
  title?: string | null;
  source_type?: MemoSourceType;
  project_key?: string | null;
  /**
   * 사용자가 "저장해줘" 같은 명시 의도를 표한 경우에만 true.
   * 오케스트레이터/챗 UI 에서 저장 의도가 확인되지 않은 흐름이라면 항상 false.
   */
  explicit: boolean;
};

export type CreateMemoResult =
  | {
      status: "pending";
      pending_action_id: string;
      sensitivity_flag: boolean;
    }
  | {
      status: "blocked";
      reason: string;
    };

export type ExecuteMemoResult =
  | {
      status: "executed";
      memo_id: string;
    }
  | {
      status: "error";
      reason: string;
    };

export type RejectMemoResult =
  | { status: "rejected" }
  | { status: "error"; reason: string };

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
