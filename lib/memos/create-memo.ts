import "server-only";

import { evaluateMemoCreate } from "@/lib/policies/memo";
import { detectSensitiveContent } from "@/lib/safety/sensitive";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logMemoCreateBlocked,
  logMemoCreatePending,
  logMemoCreateRequested,
} from "@/lib/logging/audit-log";
import type { SaveMemoPayload } from "@/types/pending-action";

import type { CreateMemoInput, CreateMemoResult } from "./types";

export type CreateMemoContext = {
  user_id: string;
  user_email?: string | null;
};

/**
 * 메모 저장 **요청**을 처리한다. 실제 memos 테이블에는 쓰지 않는다.
 *
 * 성공 흐름: pending_actions(action_type=save_memo, status=awaiting_approval) insert.
 * 실패 흐름: 정책 blocked 사유를 감사 로그에 남기고 그대로 반환.
 */
export async function createMemoDraft(
  input: CreateMemoInput,
  ctx: CreateMemoContext,
): Promise<CreateMemoResult> {
  await logMemoCreateRequested({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    metadata: {
      source_type: input.source_type ?? "quick_capture",
      content_length: (input.content ?? "").length,
      explicit: input.explicit,
    },
  });

  const sensitivity = detectSensitiveContent(input.content ?? "");

  const evaluation = evaluateMemoCreate(
    {
      content: input.content ?? "",
      title: input.title ?? null,
      explicit: input.explicit,
    },
    sensitivity,
  );

  if (evaluation.decision === "block") {
    await logMemoCreateBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      reason: evaluation.reason,
      metadata: {
        sensitivity_categories: sensitivity.map((m) => m.category),
      },
    });
    return { status: "blocked", reason: evaluation.reason };
  }

  const payload: SaveMemoPayload = {
    title: (input.title ?? "").trim() || null,
    content: input.content.trim(),
    source_type: input.source_type ?? "quick_capture",
    project_key: input.project_key ?? null,
  };

  const sensitivityFlag = sensitivity.length > 0;

  const service = createServiceClient();
  const { data, error } = await service
    .from("pending_actions")
    .insert({
      user_id: ctx.user_id,
      action_type: "save_memo",
      target_type: "memo",
      status: "awaiting_approval",
      payload,
      sensitivity_flag: sensitivityFlag,
    })
    .select("id")
    .single();

  if (error || !data) {
    await logMemoCreateBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      reason: "pending_action_insert_failed",
      metadata: {
        error_message: error?.message ?? "unknown",
      },
    });
    return { status: "blocked", reason: "pending_action_insert_failed" };
  }

  await logMemoCreatePending({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    pending_action_id: data.id,
    sensitivity_flag: sensitivityFlag,
    metadata: {
      sensitivity_categories: sensitivity.map((m) => m.category),
    },
  });

  return {
    status: "pending",
    pending_action_id: data.id,
    sensitivity_flag: sensitivityFlag,
  };
}
