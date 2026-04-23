import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  logDocumentReadSummaries,
  logDocumentReadSummariesFailed,
  logDocumentReadSummariesStarted,
  type DocumentReadSource,
} from "@/lib/logging/audit-log";
import type { DocumentSummariesTypeQuery } from "@/lib/policies/document-summaries-read";
import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type {
  DocumentSummariesLatestBundle,
  DocumentSummariesListPayload,
  DocumentSummaryReadItem,
  DocumentSummaryType,
} from "@/types/document";

import {
  loadLatestSummaryReadOneForUser,
  loadLatestSummaryReadTripletForUser,
} from "./document-latest-summaries-load";

export type ListDocumentSummariesContext = {
  user_id: string;
  user_email?: string | null;
  source: DocumentReadSource;
};

export type ListDocumentSummariesOptions = {
  type: DocumentSummariesTypeQuery;
  latest: boolean;
  /** `latest=false` 일 때만 적용. */
  limit: number;
};

export type ListDocumentSummariesResult =
  | { ok: true; data: DocumentSummariesListPayload }
  | { ok: false; reason: "not_found" | "forbidden" | "query_failed"; error_message?: string };

function mapRowFromDb(row: {
  id: string;
  summary_type: DocumentSummaryType;
  content: string;
  source_ranges: Record<string, unknown> | null;
  created_at: string;
}): DocumentSummaryReadItem {
  return {
    id: row.id,
    summary_type: row.summary_type,
    content: sanitizeStoredSummaryForRead(row.content),
    created_at: row.created_at,
    source_ranges: row.source_ranges,
  };
}

async function verifyDocumentOwned(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const { data, error } = await supabase
    .from("documents")
    .select("id,user_id")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    return "not_found";
  }
  const row = data as { user_id: string };
  if (row.user_id !== userId) {
    return "forbidden";
  }
  return "ok";
}

function buildLatestBundle(
  summary: DocumentSummaryReadItem | null,
  comparison: DocumentSummaryReadItem | null,
  analysis: DocumentSummaryReadItem | null,
): DocumentSummariesLatestBundle | undefined {
  const out: DocumentSummariesLatestBundle = {};
  if (summary) out.summary = summary;
  if (comparison) out.comparison = comparison;
  if (analysis) out.analysis = analysis;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * 문서에 연결된 `document_summaries` 를 타입·최신/목록 모드로 조회한다.
 * 원문 청크는 반환하지 않는다.
 */
export async function listDocumentSummaries(
  supabase: SupabaseClient,
  documentId: string,
  ctx: ListDocumentSummariesContext,
  options: ListDocumentSummariesOptions,
): Promise<ListDocumentSummariesResult> {
  await logDocumentReadSummariesStarted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
    source: ctx.source,
    type_filter: options.type,
    latest: options.latest,
    limit: options.latest ? null : options.limit,
  });

  const owned = await verifyDocumentOwned(supabase, documentId, ctx.user_id);
  if (owned === "not_found") {
    await logDocumentReadSummariesFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
      error_code: "not_found",
    });
    return { ok: false, reason: "not_found" };
  }
  if (owned === "forbidden") {
    await logDocumentReadSummariesFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
      error_code: "forbidden",
    });
    return { ok: false, reason: "forbidden" };
  }

  if (options.latest) {
    if (options.type === "all") {
      const { summary: s, comparison: c, analysis: a } =
        await loadLatestSummaryReadTripletForUser(supabase, documentId, ctx.user_id);
      const latest = buildLatestBundle(s, c, a);
      const items = [s, c, a].filter(Boolean) as DocumentSummaryReadItem[];
      items.sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : 0));

      const data: DocumentSummariesListPayload = {
        document_id: documentId,
        items,
        ...(latest ? { latest } : {}),
      };

      await logDocumentReadSummaries({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        document_id: documentId,
        source: ctx.source,
        type_filter: options.type,
        latest: true,
        item_count: items.length,
        has_latest_block: Boolean(latest),
      });
      return { ok: true, data };
    }

    const st = options.type as DocumentSummaryType;
    const one = await loadLatestSummaryReadOneForUser(supabase, documentId, ctx.user_id, st);
    const items = one ? [one] : [];
    let latest: DocumentSummariesLatestBundle | undefined;
    if (one) {
      if (st === "summary") latest = { summary: one };
      else if (st === "comparison") latest = { comparison: one };
      else latest = { analysis: one };
    }

    const data: DocumentSummariesListPayload = {
      document_id: documentId,
      items,
      ...(latest ? { latest } : {}),
    };

    await logDocumentReadSummaries({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
      type_filter: options.type,
      latest: true,
      item_count: items.length,
      has_latest_block: Boolean(latest),
    });
    return { ok: true, data };
  }

  let q = supabase
    .from("document_summaries")
    .select("id,summary_type,content,source_ranges,created_at")
    .eq("document_id", documentId)
    .eq("user_id", ctx.user_id);

  if (options.type !== "all") {
    q = q.eq("summary_type", options.type);
  }

  const { data: rows, error } = await q
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (error) {
    await logDocumentReadSummariesFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: documentId,
      source: ctx.source,
      error_code: "query_failed",
      error_message: error.message,
    });
    return { ok: false, reason: "query_failed", error_message: error.message };
  }

  const items = (rows ?? []).map((r) =>
    mapRowFromDb(
      r as {
        id: string;
        summary_type: DocumentSummaryType;
        content: string;
        source_ranges: Record<string, unknown> | null;
        created_at: string;
      },
    ),
  );
  const data: DocumentSummariesListPayload = {
    document_id: documentId,
    items,
  };

  await logDocumentReadSummaries({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: documentId,
    source: ctx.source,
    type_filter: options.type,
    latest: false,
    item_count: items.length,
    has_latest_block: false,
  });
  return { ok: true, data };
}

export type GetLatestDocumentSummariesResult =
  | { ok: true; latest: DocumentSummariesLatestBundle }
  | { ok: false; reason: "not_found" | "forbidden" };

/**
 * 타입별 최신 1건 맵만 필요할 때 (상세/목록 DTO 확장·assistant 재사용).
 * 감사 로그는 남기지 않는다. 호출부에서 필요 시 `listDocumentSummaries` 를 쓴다.
 */
export async function getLatestDocumentSummariesForDocument(
  supabase: SupabaseClient,
  documentId: string,
  ctx: Pick<ListDocumentSummariesContext, "user_id">,
): Promise<GetLatestDocumentSummariesResult> {
  const owned = await verifyDocumentOwned(supabase, documentId, ctx.user_id);
  if (owned === "not_found") {
    return { ok: false, reason: "not_found" };
  }
  if (owned === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const { summary: s, comparison: c, analysis: a } = await loadLatestSummaryReadTripletForUser(
    supabase,
    documentId,
    ctx.user_id,
  );
  const latest: DocumentSummariesLatestBundle = {};
  if (s) latest.summary = s;
  if (c) latest.comparison = c;
  if (a) latest.analysis = a;
  return { ok: true, latest };
}
