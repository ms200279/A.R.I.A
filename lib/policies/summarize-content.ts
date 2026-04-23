/**
 * 요약 파이프라인용 본문 정책(저장 정책과 분리).
 * - memo: `MEMO_CONTENT_MAX`
 * - document: `DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS`(문서 도메인 전처리·청크 합성 후 길이)
 * - mail: document 와 동일 상한(임시; 수신 파이프라인 확정 후 조정)
 */

import type { ResourceKind } from "@/lib/summarizers/types";

import { DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS } from "./document-summary";
import { MEMO_CONTENT_MAX } from "./memo";

export type SummarizeContentPolicyResult =
  | { ok: true }
  | { ok: false; reason: "too_long" };

export function evaluateSummarizerContentPolicy({
  resourceKind,
  content,
}: {
  resourceKind: ResourceKind;
  content: string;
}): SummarizeContentPolicyResult {
  const len = (content ?? "").length;
  const max =
    resourceKind === "document"
      ? DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS
      : resourceKind === "mail"
        ? DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS // TODO(mail): 수신 파이프라인 확정 후 조정
        : MEMO_CONTENT_MAX;
  if (len > max) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true };
}
