import "server-only";

import type { MemoSourceType } from "@/types/memo";
import type { PendingActionStatus } from "@/types/pending-action";

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
      /**
       * payload 검증/정책 재검사 실패 등 "정책적으로 실행을 막은" 결과.
       * pending_action 은 `blocked` 로 전이되며 동일 id 로 재시도해도 같은 결론.
       * HTTP 4xx/5xx 가 아닌 200 + body 로 표현하는 것이 적절하다.
       */
      status: "blocked";
      reason: string;
    }
  | {
      /** awaiting_approval 이 아닌 상태에서 confirm 이 들어온 경우(재실행 금지). */
      status: "invalid_state";
      current_status: PendingActionStatus;
    }
  | {
      /**
       * 일시적/기술적 오류 (claim 실패, memo_insert_failed 등).
       * 원칙적으로 재시도 가능하며 HTTP 5xx 로 표현한다.
       */
      status: "error";
      reason: string;
    };

export type RejectMemoResult =
  | { status: "rejected" }
  | {
      status: "invalid_state";
      current_status: PendingActionStatus;
    }
  | { status: "error"; reason: string };

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
