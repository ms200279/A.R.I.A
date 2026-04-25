import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  logDocumentListRead,
  logDocumentListReadFailed,
  logDocumentListReadStarted,
  type DocumentReadSource,
} from "@/lib/logging/audit-log";
import {
  evaluateDocumentCanCompareEligibleForListItem,
  evaluateDocumentCanSummarize,
} from "@/lib/policies/document-detail";
import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type {
  Document,
  DocumentLatestComparisonPublic,
  DocumentListItemPayload,
  DocumentSummaryType,
} from "@/types/document";

import { DOCUMENT_LIST_ROW_SELECT } from "./document-columns";
import { getLatestComparisonForDocumentsBatch } from "./get-latest-comparison-for-document";

export const DEFAULT_DOCUMENT_LIST_LIMIT = 30;
export const MAX_DOCUMENT_LIST_LIMIT = 100;

export type DocumentListSortField = "created_at" | "updated_at";

export type ListDocumentsOptions = {
  limit?: number;
  cursor?: string | null;
  sort?: DocumentListSortField;
  scope_user_id: string;
  audit?: {
    actor_id: string;
    actor_email?: string | null;
    source: DocumentReadSource;
  };
};

export type ListDocumentsResult = {
  items: DocumentListItemPayload[];
  next_cursor: string | null;
  sort: DocumentListSortField;
};

const SUMMARY_PREVIEW_MAX_CHARS = 160;

type ListRow = Pick<
  Document,
  | "id"
  | "user_id"
  | "title"
  | "file_name"
  | "file_type"
  | "sha256_hash"
  | "status"
  | "parsing_status"
  | "preprocessing_status"
  | "summary_status"
  | "parsing_error_code"
  | "created_at"
  | "updated_at"
>;

type SummaryBatchRow = {
  document_id: string;
  summary_type: DocumentSummaryType;
  content: string;
  updated_at: string;
};

/** 문서 id × summary_type 당 `updated_at` 최신 1행. */
function pickLatestSummariesByDocumentAndType(
  rows: SummaryBatchRow[],
): Map<string, Map<DocumentSummaryType, SummaryBatchRow>> {
  const out = new Map<string, Map<DocumentSummaryType, SummaryBatchRow>>();
  for (const r of rows) {
    let inner = out.get(r.document_id);
    if (!inner) {
      inner = new Map();
      out.set(r.document_id, inner);
    }
    const prev = inner.get(r.summary_type);
    if (!prev || r.updated_at > prev.updated_at) {
      inner.set(r.summary_type, r);
    }
  }
  return out;
}

function previewFromStoredContent(content: string | undefined, exists: boolean): string | null {
  if (!exists) return null;
  const sanitized = content ? sanitizeStoredSummaryForRead(content) : "";
  if (!sanitized) return null;
  return sanitized.length > SUMMARY_PREVIEW_MAX_CHARS
    ? `${sanitized.slice(0, SUMMARY_PREVIEW_MAX_CHARS - 1)}…`
    : sanitized;
}

function countChunksByDocument(
  rows: { document_id: string }[] | null,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    m.set(r.document_id, (m.get(r.document_id) ?? 0) + 1);
  }
  return m;
}

/**
 * 현재 사용자 스코프(RLS + `user_id` 필터)로 문서 목록을 구성한다.
 * 행당 원문·청크 본문은 로드하지 않는다.
 */
export async function listDocuments(
  supabase: SupabaseClient,
  options: ListDocumentsOptions,
): Promise<ListDocumentsResult> {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_DOCUMENT_LIST_LIMIT, 1),
    MAX_DOCUMENT_LIST_LIMIT,
  );
  const sort: DocumentListSortField = options.sort ?? "updated_at";

  if (options.audit) {
    await logDocumentListReadStarted({
      actor_id: options.audit.actor_id,
      actor_email: options.audit.actor_email ?? null,
      source: options.audit.source,
    });
  }

  let query = supabase
    .from("documents")
    .select(DOCUMENT_LIST_ROW_SELECT)
    .eq("user_id", options.scope_user_id)
    .order(sort, { ascending: false })
    .limit(limit + 1);

  if (options.cursor) {
    query = query.lt(sort, options.cursor);
  }

  const { data, error } = await query;

  if (error || !data) {
    if (options.audit) {
      await logDocumentListReadFailed({
        actor_id: options.audit.actor_id,
        actor_email: options.audit.actor_email ?? null,
        source: options.audit.source,
        error_code: "documents_query_failed",
        error_message: error?.message ?? null,
      });
    }
    return { items: [], next_cursor: null, sort };
  }

  const rows = data as ListRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const ids = pageRows.map((r) => r.id);

  let chunkMap = new Map<string, number>();
  let summaryByDocAndType = new Map<string, Map<DocumentSummaryType, SummaryBatchRow>>();
  let compMap = new Map<string, DocumentLatestComparisonPublic | null>();

  if (ids.length > 0) {
    const [{ data: chunkRows, error: chunkErr }, { data: summaryRows, error: sumErr }, batchComp] =
      await Promise.all([
        supabase.from("document_chunks").select("document_id").in("document_id", ids),
        supabase
          .from("document_summaries")
          .select("document_id,summary_type,content,updated_at")
          .in("summary_type", ["summary", "analysis"])
          .in("document_id", ids),
        getLatestComparisonForDocumentsBatch(supabase, options.scope_user_id, ids),
      ]);

    if (chunkErr) {
      if (options.audit) {
        await logDocumentListReadFailed({
          actor_id: options.audit.actor_id,
          actor_email: options.audit.actor_email ?? null,
          source: options.audit.source,
          error_code: "document_chunks_batch_failed",
          error_message: chunkErr.message,
        });
      }
    } else {
      chunkMap = countChunksByDocument(chunkRows);
    }

    if (sumErr) {
      if (options.audit) {
        await logDocumentListReadFailed({
          actor_id: options.audit.actor_id,
          actor_email: options.audit.actor_email ?? null,
          source: options.audit.source,
          error_code: "document_summaries_batch_failed",
          error_message: sumErr.message,
        });
      }
    } else if (summaryRows) {
      summaryByDocAndType = pickLatestSummariesByDocumentAndType(
        summaryRows as SummaryBatchRow[],
      );
    }

    compMap = batchComp;
  }

  const items: DocumentListItemPayload[] = pageRows.map((row) => {
    const perType = summaryByDocAndType.get(row.id);
    const sum = perType?.get("summary");
    const ana = perType?.get("analysis");
    const lc = compMap.get(row.id) ?? null;
    const latest_summary_exists = Boolean(sum);
    const latest_comparison_exists = Boolean(lc);
    const latest_analysis_exists = Boolean(ana);
    const latest_summary_preview = previewFromStoredContent(sum?.content, latest_summary_exists);
    const latest_comparison_preview = lc?.content_preview?.trim() ? lc.content_preview : null;
    const latest_analysis_preview = previewFromStoredContent(ana?.content, latest_analysis_exists);

    const chunkCount = chunkMap.get(row.id) ?? 0;

    return {
      id: row.id,
      title: row.title,
      file_name: row.file_name,
      file_type: row.file_type,
      status: row.status,
      parsing_status: row.parsing_status,
      preprocessing_status: row.preprocessing_status,
      summary_status: row.summary_status,
      parsing_error_code: row.parsing_error_code,
      sha256_hash: row.sha256_hash,
      created_at: row.created_at,
      updated_at: row.updated_at,
      latest_summary_exists,
      latest_summary_preview,
      latest_comparison_exists,
      latest_comparison_preview,
      latest_comparison_anchor_role: lc?.current_document_anchor_role ?? null,
      latest_analysis_exists,
      latest_analysis_preview,
      can_summarize: evaluateDocumentCanSummarize({
        status: row.status,
        parsing_status: row.parsing_status,
        preprocessing_status: row.preprocessing_status,
        summary_status: row.summary_status,
        chunkCount,
        hasParsedText: false,
      }),
      can_compare: evaluateDocumentCanCompareEligibleForListItem({
        status: row.status,
        parsing_status: row.parsing_status,
        preprocessing_status: row.preprocessing_status,
        summary_status: row.summary_status,
        chunkCount,
      }),
    };
  });

  const last = items.length > 0 ? pageRows[pageRows.length - 1] : undefined;
  const next_cursor =
    hasMore && last ? (last[sort] as string) : null;

  if (options.audit) {
    await logDocumentListRead({
      actor_id: options.audit.actor_id,
      actor_email: options.audit.actor_email ?? null,
      source: options.audit.source,
      result_count: items.length,
      sort,
      has_cursor: Boolean(options.cursor),
    });
  }

  return { items, next_cursor, sort };
}
