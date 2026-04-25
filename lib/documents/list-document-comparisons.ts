import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStoredSummaryForRead } from "@/lib/safety/document-text";
import type {
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListResult,
  ComparisonHistoryListRoleFilter,
  ComparisonHistoryListSort,
} from "@/types/comparisons";

import {
  buildKeysetOrFilter,
  cursorMatchesRequestListState,
  decodeComparisonListCursor,
  encodeComparisonListCursor,
} from "./comparison-list-cursor";
import { normalizeComparisonAnchorRole } from "./comparison-anchor-role";
import { normalizeEmbeddedDocumentMeta } from "./supabase-embed-doc";

const CONTENT_PREVIEW_MAX = 160;
export const DEFAULT_DOCUMENT_COMPARISONS_LIMIT = 20;
export const MAX_DOCUMENT_COMPARISONS_LIMIT = 50;

/**
 * `comparison_history_documents!inner` 이미 `document_id`로 걸려 있을 때, 앵커 role 로 추가 필터.
 * PostgREST 체인 타입( select 이후 `filter` / `is` )이 버전마다 달라 `any` 로 단일화.
 */
function applyContextAnchorRoleFilterToComparisonHistoryQuery(
  q: any,
  roleFilter: ComparisonHistoryListRoleFilter,
): any {
  if (roleFilter === "all") {
    return q;
  }
  if (roleFilter === "unknown") {
    return q.is("comparison_history_documents.anchor_role", null);
  }
  return q.filter("comparison_history_documents.anchor_role", "eq", roleFilter);
}

export type ListDocumentComparisonsContext = {
  user_id: string;
};

export type ListComparisonHistoriesPageInput = {
  userId: string;
  /**
   * 문서 맥락(문서 상세/문서 API): 역할·상대문서 프리뷰.
   * `null`이면 전체 비교 목록(이 사용자); anchor_role 은 null.
   */
  contextDocumentId: string | null;
  limit: number;
  /** base64url(JSON). 없으면 첫 페이지. */
  cursor: string | null;
  sort: ComparisonHistoryListSort;
  /**
   * 문서 맥락에서 `comparison_history_documents.anchor_role` (정규화·null=unknown) 필터.
   * `contextDocumentId` 가 없으면 항상 `all` 만 적용된다.
   */
  roleFilter: ComparisonHistoryListRoleFilter;
};

export type ListComparisonHistoriesPageOutput =
  | { ok: true; data: ComparisonHistoryListResult }
  | { ok: false; error: "invalid_cursor" };

type HistRowFlat = {
  id: string;
  summary_id: string | null;
  primary_document_id: string;
  created_at: string;
  content: string;
};

/**
 * `comparison_history_documents!inner` 조인(문서 맥락) + 키셋(created_at,id) + `created_at` asc/desc.
 * 전역 목록은 `contextDocumentId: null` 로 동일 `comparison_histories` 쿼리.
 *
 * TODO(정렬 확장): `anchor_role`·다중 키 정렬이 필요해지면 키셋/커서에 정렬 축이 버전ed 로 들어가야 하며
 * `ComparisonHistoryListSort` union 과 별도 인덱스를 맞출 것.
 */
export async function listComparisonHistoriesPage(
  supabase: SupabaseClient,
  input: ListComparisonHistoriesPageInput,
): Promise<ListComparisonHistoriesPageOutput> {
  const limit = Math.min(Math.max(1, input.limit), MAX_DOCUMENT_COMPARISONS_LIMIT);
  const sort: ComparisonHistoryListSort = input.sort;
  const roleFilter: ComparisonHistoryListRoleFilter = input.contextDocumentId
    ? input.roleFilter
    : "all";
  const ascending = sort === "created_at_asc";
  const keysetOrder: "asc" | "desc" = ascending ? "asc" : "desc";

  let cur: { created_at: string; id: string } | null = null;
  if (input.cursor && input.cursor.trim() !== "") {
    const d = decodeComparisonListCursor(input.cursor);
    if (!d) {
      return { ok: false, error: "invalid_cursor" };
    }
    if (!cursorMatchesRequestListState(d, sort, roleFilter)) {
      return { ok: false, error: "invalid_cursor" };
    }
    cur = { created_at: d.created_at, id: d.id };
  }

  const selectBase =
    "id, summary_id, primary_document_id, created_at, content, comparison_history_documents!inner(document_id)";

  let q = supabase
    .from("comparison_histories")
    .select(input.contextDocumentId ? selectBase : "id, summary_id, primary_document_id, created_at, content")
    .eq("user_id", input.userId);

  if (input.contextDocumentId) {
    q = q.filter("comparison_history_documents.document_id", "eq", input.contextDocumentId);
    q = applyContextAnchorRoleFilterToComparisonHistoryQuery(q, roleFilter);
  }

  if (cur) {
    q = q.or(buildKeysetOrFilter(cur.created_at, cur.id, keysetOrder));
  }

  q = q
    .order("created_at", { ascending, nullsFirst: false })
    .order("id", { ascending, nullsFirst: false });

  const fetchLimit = limit + 1;
  const { data, error } = await q.limit(fetchLimit);

  if (error) {
    // 조인/필드명 실패 시: 문서 맥락만 2-step 폴백(비권장·대용량 취약) 대신 throw → route 500
    throw new Error(`comparison_histories: ${error.message}`);
  }

  const rows = (data ?? []) as unknown[];
  const hists: HistRowFlat[] = rows.map((raw) => flattenHistoryRow(raw));

  const hasMore = hists.length > limit;
  const pageRows = hasMore ? hists.slice(0, limit) : hists;
  const rowIds = pageRows.map((h) => h.id);
  if (rowIds.length === 0) {
    return {
      ok: true,
      data: {
        items: [],
        pageInfo: { nextCursor: null, hasMore: false },
        sort,
        roleFilter,
      },
    };
  }

  const { data: anchors } = await supabase
    .from("comparison_history_documents")
    .select("comparison_history_id, document_id, anchor_role, sort_order, documents(title, file_name)")
    .in("comparison_history_id", rowIds)
    .eq("user_id", input.userId);

  type AnchorRow = {
    comparison_history_id: string;
    document_id: string;
    anchor_role: string | null;
    sort_order: number | null;
    documents: unknown;
  };
  const anchorList = (anchors ?? []) as AnchorRow[];
  const anchorByHist = new Map<string, AnchorRow[]>();
  for (const a of anchorList) {
    const hid = a.comparison_history_id;
    if (!anchorByHist.has(hid)) anchorByHist.set(hid, []);
    anchorByHist.get(hid)!.push(a);
  }

  const selfByHist = new Map<string, { anchor_role: string | null; sort_order: number | null }>();
  if (input.contextDocumentId) {
    for (const a of anchorList) {
      if (a.document_id === input.contextDocumentId) {
        selfByHist.set(a.comparison_history_id, {
          anchor_role: a.anchor_role,
          sort_order: a.sort_order,
        });
      }
    }
  }

  const items: ComparisonHistoryListItemPayload[] = pageRows.map((h) => {
    const hid = h.id;
    const alist = anchorByHist.get(hid) ?? [];
    const contextId = input.contextDocumentId;
    const others = contextId
      ? alist.filter((x) => x.document_id !== contextId)
      : alist;
    const labels = (contextId ? others : alist).map((x) => {
      const doc = normalizeEmbeddedDocumentMeta(x.documents);
      const idShort = x.document_id.slice(0, 8);
      return doc?.title?.trim() || doc?.file_name || idShort;
    });
    const rawContent = h.content;
    const sanitized = sanitizeStoredSummaryForRead(rawContent);
    const content_preview =
      sanitized.length > CONTENT_PREVIEW_MAX
        ? `${sanitized.slice(0, CONTENT_PREVIEW_MAX - 1)}…`
        : sanitized;

    const self = contextId ? selfByHist.get(hid) : null;
    return {
      comparison_id: hid,
      summary_id: h.summary_id,
      primary_document_id: h.primary_document_id,
      created_at: h.created_at,
      document_count: alist.length,
      other_documents_preview: labels.join(", ") || "—",
      content_preview,
      current_document_anchor_role: self
        ? normalizeComparisonAnchorRole(self.anchor_role)
        : null,
      current_document_sort_order: self?.sort_order ?? null,
    };
  });

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeComparisonListCursor({
          v: 1,
          created_at: last.created_at,
          id: last.id,
          sort,
          roleFilter,
        })
      : null;

  return {
    ok: true,
    data: {
      items,
      pageInfo: { nextCursor, hasMore },
      sort,
      roleFilter,
    },
  };
}

/**
 * join 응답에 중첩 `comparison_history_documents`가 있을 수 있어 id·content만 평탄화.
 */
function flattenHistoryRow(raw: unknown): HistRowFlat {
  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      summary_id: null,
      primary_document_id: "",
      created_at: "",
      content: "",
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    summary_id: o.summary_id === null || typeof o.summary_id === "string" ? (o.summary_id as string | null) : null,
    primary_document_id: String(o.primary_document_id),
    created_at: String(o.created_at),
    content: String(o.content ?? ""),
  };
}

/**
 * @deprecated `listComparisonHistoriesPage` 사용(페이지·정렬), 단순 **첫 페이지 항목만** 필요한 호출용.
 * 비교 API enrich 등: `cursor: null` 과 동일.
 */
export async function listDocumentComparisons(
  supabase: SupabaseClient,
  documentId: string,
  ctx: ListDocumentComparisonsContext,
  options?: { limit?: number },
): Promise<ComparisonHistoryListItemPayload[]> {
  const r = await listComparisonHistoriesPage(supabase, {
    userId: ctx.user_id,
    contextDocumentId: documentId,
    limit: options?.limit ?? DEFAULT_DOCUMENT_COMPARISONS_LIMIT,
    cursor: null,
    sort: "created_at_desc",
    roleFilter: "all",
  });
  if (!r.ok) {
    return [];
  }
  return r.data.items;
}
