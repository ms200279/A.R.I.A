import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listDocumentComparisons } from "@/lib/documents/list-document-comparisons";
import type { AssistantMessageAttachment } from "@/types/assistant-attachments";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * `get_document_detail` 직후: 히스토리 목록 DTO( read-side )가 있으면
 * `document_latest_comparison_card` 를 `comparison_history_item` 으로 대체한다.
 * 목록/조인 쿼리 실패·빈 목록이면 기존(레거시) 첨부를 유지한다.
 */
export async function enrichDocumentDetailAttachmentsWithComparisonHistory(
  supabase: SupabaseClient,
  userId: string,
  existing: AssistantMessageAttachment[],
  payload: unknown,
): Promise<AssistantMessageAttachment[]> {
  try {
    if (!isRecord(payload) || !isRecord(payload.document)) return existing;
    const doc = payload.document;
    const documentId = typeof doc.id === "string" ? doc.id : null;
    if (!documentId) return existing;

    const lc = doc.latest_comparison;
    if (!isRecord(lc) || typeof lc.id !== "string") return existing;

    const list = await listDocumentComparisons(
      supabase,
      documentId,
      { user_id: userId },
      { limit: 40 },
    );

    if (!list.length) return existing;

    const byHistory =
      typeof lc.comparison_id === "string" && lc.comparison_id
        ? list.find((i) => i.comparison_id === lc.comparison_id)
        : null;
    const bySummary = list.find((i) => i.summary_id === lc.id) ?? null;
    const item = byHistory ?? bySummary ?? list[0] ?? null;
    if (!item) return existing;

    const next: AssistantMessageAttachment = {
      kind: "comparison_history_item",
      context_document_id: documentId,
      item,
    };

    return existing
      .filter(
        (x) =>
          !(
            (x.kind === "document_latest_comparison_card" && x.documentId === documentId) ||
            (x.kind === "comparison_history_item" && x.context_document_id === documentId)
          ),
      )
      .concat([next]);
  } catch {
    return existing;
  }
}
