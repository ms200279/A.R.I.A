import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  logDocumentCompareHistoryFailed,
  logDocumentCompareHistorySaved,
} from "@/lib/logging/audit-log";

export type PersistComparisonHistoryArgs = {
  service: SupabaseClient;
  userId: string;
  userEmail?: string | null;
  comparedDocumentIdsOrdered: string[];
  primaryDocumentId: string;
  summaryId: string;
  content: string;
  sourceRanges: Record<string, unknown> | null;
};

export type PersistComparisonHistoryResult =
  | { ok: true; comparisonHistoryId: string }
  | { ok: false; reason: string; errorMessage?: string };

/**
 * 비교 1회 실행에 대해 히스토리 행 + 참여 문서 앵커를 기록한다.
 * service_role 클라이언트로 호출한다. 실패해도 호출부 compare HTTP 결과는 유지할 수 있다.
 */
export async function persistComparisonHistoryWithAnchors(
  args: PersistComparisonHistoryArgs,
): Promise<PersistComparisonHistoryResult> {
  const {
    service,
    userId,
    userEmail,
    comparedDocumentIdsOrdered,
    primaryDocumentId,
    summaryId,
    content,
    sourceRanges,
  } = args;

  const { data: hist, error: hErr } = await service
    .from("comparison_histories")
    .insert({
      user_id: userId,
      summary_id: summaryId,
      primary_document_id: primaryDocumentId,
      content,
      source_ranges: sourceRanges,
    })
    .select("id")
    .single();

  if (hErr || !hist) {
    await logDocumentCompareHistoryFailed({
      actor_id: userId,
      actor_email: userEmail ?? null,
      reason: "comparison_history_insert_failed",
      primary_document_id: primaryDocumentId,
      error_message: hErr?.message ?? null,
    });
    return {
      ok: false,
      reason: "comparison_history_insert_failed",
      errorMessage: hErr?.message,
    };
  }

  const historyId = hist.id as string;
  const anchorRows = comparedDocumentIdsOrdered.map((documentId, i) => ({
    comparison_history_id: historyId,
    user_id: userId,
    document_id: documentId,
    anchor_role: (i === 0 ? "primary" : "peer") as "primary" | "peer",
    sort_order: i,
  }));

  const { error: aErr } = await service.from("comparison_history_documents").insert(anchorRows);

  if (aErr) {
    await service.from("comparison_histories").delete().eq("id", historyId);
    await logDocumentCompareHistoryFailed({
      actor_id: userId,
      actor_email: userEmail ?? null,
      reason: "comparison_anchors_insert_failed",
      primary_document_id: primaryDocumentId,
      error_message: aErr.message,
    });
    return {
      ok: false,
      reason: "comparison_anchors_insert_failed",
      errorMessage: aErr.message,
    };
  }

  await logDocumentCompareHistorySaved({
    actor_id: userId,
    actor_email: userEmail ?? null,
    comparison_history_id: historyId,
    summary_id: summaryId,
    document_count: comparedDocumentIdsOrdered.length,
  });

  return { ok: true, comparisonHistoryId: historyId };
}
