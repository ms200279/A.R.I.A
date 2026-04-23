import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logDocumentCompareCompleted,
  logDocumentCompareFailed,
  logDocumentComparePolicyBlocked,
  logDocumentCompareStarted,
} from "@/lib/logging/audit-log";
import {
  DOCUMENT_COMPARE_COMBINED_INPUT_MAX_CHARS,
} from "@/lib/policies/document-llm";
import { evaluateSummarizerContentPolicy } from "@/lib/policies/summarize-content";
import { runCompareDocumentsLlm } from "@/lib/summarizers/document-llm-tasks";
import type { Document, DocumentCompareResultPayload, DocumentSummary } from "@/types/document";

import { DOCUMENT_ROW_SELECT, DOCUMENT_SUMMARY_ROW_SELECT } from "./document-columns";
import { loadSanitizedDocumentTextForModel } from "./document-model-input";
import { persistComparisonHistoryWithAnchors } from "./save-comparison-history";

const MAX_SUMMARY_DB_CHARS = 32_000;

export type CompareDocumentsContext = {
  user_id: string;
  user_email?: string | null;
};

export type CompareDocumentsResult =
  | {
      status: "ok";
      result: DocumentCompareResultPayload;
      persisted: boolean;
      summary: DocumentSummary | null;
      /** 히스토리·앵커 저장 성공 시 id. 실패 시 null(요약 행은 저장됐을 수 있음). */
      comparison_history_id: string | null;
    }
  | { status: "error"; reason: string };

function dedupePreserve(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function proportionallyTruncateDocs(
  texts: string[],
  maxTotal: number,
): { out: string[]; truncated: boolean } {
  const sum = texts.reduce((a, t) => a + t.length, 0);
  if (sum <= maxTotal) {
    return { out: texts, truncated: false };
  }
  const scaled = texts.map((t) => {
    const share = Math.floor((maxTotal * t.length) / sum);
    const cap = Math.max(200, share);
    return t.length <= cap ? t : `${t.slice(0, cap)}\n…[truncated]`;
  });
  return { out: scaled, truncated: true };
}

function serializeCompareForDb(payload: DocumentCompareResultPayload): string {
  const s = JSON.stringify(payload);
  if (s.length <= MAX_SUMMARY_DB_CHARS) return s;
  const clipped: DocumentCompareResultPayload = {
    ...payload,
    summary_of_differences: payload.summary_of_differences.slice(0, 4000),
    summary_of_common_points: payload.summary_of_common_points.slice(0, 4000),
    notable_gaps_or_conflicts: payload.notable_gaps_or_conflicts.slice(0, 4000),
    source_ranges: { ...(payload.source_ranges ?? {}), content_truncated: true },
  };
  let out = JSON.stringify(clipped);
  if (out.length > MAX_SUMMARY_DB_CHARS) {
    out = out.slice(0, MAX_SUMMARY_DB_CHARS - 40) + `,"_truncated":true}`;
  }
  return out;
}

/**
 * 다문서 비교.
 *
 * 저장 정책:
 * - `document_ids[0]` 을 `document_id` FK 로 삼아 `summary_type='comparison'` 행을 UPSERT(기존 호환).
 * - 추가로 `comparison_histories` + `comparison_history_documents` 에 이번 실행 스냅샷·참여 문서 전체를 append.
 * LLM 실패·폴백 포함 결과는 항상 API 에 반환하며, DB 저장 실패 시에도 `result` 는 유지된다.
 */
export async function compareDocuments(
  documentIds: string[],
  ctx: CompareDocumentsContext,
): Promise<CompareDocumentsResult> {
  const ids = dedupePreserve(documentIds);
  if (ids.length < 2) {
    return { status: "error", reason: "compare_requires_two_documents" };
  }
  if (ids.length > 8) {
    return { status: "error", reason: "compare_too_many_documents" };
  }

  await logDocumentCompareStarted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_ids: ids,
  });

  const supabase = await createClient();
  const { data: rows, error: fetchErr } = await supabase
    .from("documents")
    .select(DOCUMENT_ROW_SELECT)
    .in("id", ids)
    .eq("user_id", ctx.user_id);

  if (fetchErr || !rows || rows.length !== ids.length) {
    await logDocumentComparePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      reason: "compare_documents_scope_mismatch",
      document_ids: ids,
    });
    return { status: "error", reason: "forbidden_or_missing_document" };
  }

  const rowById = new Map((rows as Document[]).map((r) => [r.id, r]));
  const ordered = ids.map((id) => rowById.get(id)!);

  const labeled: { label: string; title: string | null; text: string }[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const d = ordered[i]!;
    const loaded = await loadSanitizedDocumentTextForModel(supabase, d.id);
    if (!loaded.ok) {
      await logDocumentComparePolicyBlocked({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        reason: loaded.reason,
        document_ids: ids,
      });
      return { status: "error", reason: loaded.reason };
    }
    labeled.push({
      label: `Document ${i + 1} (id:${d.id.slice(0, 8)})`,
      title: d.title,
      text: loaded.text,
    });
  }

  const texts = labeled.map((l) => l.text);
  const { out: scaled, truncated: inputTruncated } = proportionallyTruncateDocs(
    texts,
    DOCUMENT_COMPARE_COMBINED_INPUT_MAX_CHARS,
  );
  for (let i = 0; i < labeled.length; i++) {
    labeled[i]!.text = scaled[i]!;
  }

  const combined = scaled.join("\n\n");
  const policy = evaluateSummarizerContentPolicy({
    resourceKind: "document",
    content: combined,
  });
  if (!policy.ok) {
    await logDocumentComparePolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      reason: policy.reason,
      document_ids: ids,
    });
    return { status: "error", reason: "content_policy_violation" };
  }

  const llm = await runCompareDocumentsLlm({
    userId: ctx.user_id,
    labeledDocuments: labeled,
  });

  const result: DocumentCompareResultPayload = {
    compared_document_ids: ids,
    summary_of_differences: llm.summary_of_differences,
    summary_of_common_points: llm.summary_of_common_points,
    notable_gaps_or_conflicts: llm.notable_gaps_or_conflicts,
    source_ranges: {
      input_truncated: inputTruncated,
      chunked_condensation: llm.chunked,
      provider: llm.provider,
    },
  };

  const primaryId = ids[0]!;
  const service = createServiceClient();
  const contentStr = serializeCompareForDb(result);
  const { data: upserted, error: upErr } = await service
    .from("document_summaries")
    .upsert(
      {
        document_id: primaryId,
        user_id: ctx.user_id,
        summary_type: "comparison",
        content: contentStr,
        source_ranges: {
          compared_document_ids: ids,
          provider: llm.provider,
          chunked: llm.chunked,
          input_truncated: inputTruncated,
        },
      },
      { onConflict: "document_id,summary_type" },
    )
    .select(DOCUMENT_SUMMARY_ROW_SELECT)
    .single();

  const persisted = Boolean(upserted && !upErr);
  if (!persisted) {
    await logDocumentCompareFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      reason: "comparison_persist_failed",
      primary_document_id: primaryId,
    });
  }

  await logDocumentCompareCompleted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    primary_document_id: primaryId,
    compared_document_ids: ids,
    provider: llm.provider,
    chunked: llm.chunked || inputTruncated,
  });

  let comparison_history_id: string | null = null;
  if (persisted && upserted) {
    const ph = await persistComparisonHistoryWithAnchors({
      service,
      userId: ctx.user_id,
      userEmail: ctx.user_email ?? null,
      comparedDocumentIdsOrdered: ids,
      primaryDocumentId: primaryId,
      summaryId: (upserted as DocumentSummary).id,
      content: contentStr,
      sourceRanges: {
        compared_document_ids: ids,
        provider: llm.provider,
        chunked: llm.chunked,
        input_truncated: inputTruncated,
      },
    });
    if (ph.ok) {
      comparison_history_id = ph.comparisonHistoryId;
    }
  }

  return {
    status: "ok",
    result,
    persisted,
    summary: persisted ? (upserted as DocumentSummary) : null,
    comparison_history_id,
  };
}
