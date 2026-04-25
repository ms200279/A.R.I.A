import "server-only";

import { z } from "zod";

import { MEMO_CONTENT_MAX } from "@/lib/policies/memo";
import { MEMO_TAGS_MAX_COUNT, MEMO_TAG_MAX_CHARS } from "@/types/memos";
import type { SaveMemoPayload } from "@/types/pending-action";

/**
 * pending_actions.payload (action_type=save_memo) 의 런타임 검증 스키마.
 *
 * - create-memo 가 넣는 payload 와 동일한 필드셋을 강제한다.
 * - confirm 단계에서 "DB 저장물" 을 신뢰하지 않고 한 번 더 parse 한다.
 *   (스키마 마이그레이션/수동 편집/이전 버전 잔존 데이터 방어)
 * - 이후 action_type 이 늘어나면 이 파일이 아닌 별도 스키마 파일을 만든다.
 */
export const SaveMemoPayloadSchema: z.ZodType<SaveMemoPayload> = z.object({
  title: z.string().nullable(),
  content: z.string().min(1, "empty_content").max(MEMO_CONTENT_MAX, "too_long"),
  source_type: z.enum(["quick_capture", "chat", "import"]),
  project_key: z.string().nullable(),
  tags: z.array(z.string().max(MEMO_TAG_MAX_CHARS)).max(MEMO_TAGS_MAX_COUNT).default([]),
});

export type SaveMemoPayloadParseResult =
  | { ok: true; payload: SaveMemoPayload }
  | { ok: false; reason: string };

export function parseSaveMemoPayload(raw: unknown): SaveMemoPayloadParseResult {
  const parsed = SaveMemoPayloadSchema.safeParse(raw);
  if (parsed.success) return { ok: true, payload: parsed.data };
  const first = parsed.error.issues[0];
  const reason = first?.message?.trim() || "invalid_payload_shape";
  return { ok: false, reason };
}
