"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buildDocumentComparisonsListSearchParams } from "@/lib/documents/comparison-history-list-ui";
import type {
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListPageInfo,
  ComparisonHistoryListRoleFilter,
  ComparisonHistoryListSort,
} from "@/types/comparisons";

const DEFAULT_LIMIT = 20;

type ListApiBody = {
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
  sort: ComparisonHistoryListSort;
  role_filter: ComparisonHistoryListRoleFilter;
};

function isListResponse(body: unknown): body is ListApiBody {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.items) || o.pageInfo === null || typeof o.pageInfo !== "object") {
    return false;
  }
  return (
    (o.sort === "created_at_asc" || o.sort === "created_at_desc") &&
    typeof o.role_filter === "string"
  );
}

export function useComparisonHistoryList(options: {
  documentId: string;
  initialItems: ComparisonHistoryListItemPayload[];
  initialPageInfo: ComparisonHistoryListPageInfo;
  initialSort: ComparisonHistoryListSort;
  initialRoleFilter: ComparisonHistoryListRoleFilter;
  limit?: number;
}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const { documentId, initialItems, initialPageInfo, initialSort, initialRoleFilter } = options;

  const [items, setItems] = useState(initialItems);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [sort, setSort] = useState<ComparisonHistoryListSort>(initialSort);
  const [roleFilter, setRoleFilter] = useState<ComparisonHistoryListRoleFilter>(initialRoleFilter);
  const [listLoading, setListLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreInFlight = useRef(false);
  const prevDocumentId = useRef(documentId);

  const refetchFromStart = useCallback(
    async (nextSort: ComparisonHistoryListSort, nextRole: ComparisonHistoryListRoleFilter) => {
      setListLoading(true);
      setError(null);
      setItems([]);
      setPageInfo({ nextCursor: null, hasMore: false });
      try {
        const p = buildDocumentComparisonsListSearchParams({
          limit,
          sort: nextSort,
          roleFilter: nextRole,
          cursor: null,
        });
        const res = await fetch(`/api/documents/${documentId}/comparisons?${p.toString()}`, {
          credentials: "same-origin",
        });
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok || !isListResponse(body)) {
          setError("목록을 불러오지 못했습니다.");
          return;
        }
        setItems(body.items);
        setPageInfo(body.pageInfo);
        setSort(body.sort);
        setRoleFilter(body.role_filter);
      } catch {
        setError("네트워크 오류입니다.");
      } finally {
        setListLoading(false);
      }
    },
    [documentId, limit],
  );

  useEffect(() => {
    if (prevDocumentId.current !== documentId) {
      prevDocumentId.current = documentId;
      setSort(initialSort);
      setRoleFilter(initialRoleFilter);
      setItems(initialItems);
      setPageInfo(initialPageInfo);
      setError(null);
      return;
    }
    setItems(initialItems);
    setPageInfo(initialPageInfo);
  }, [documentId, initialItems, initialPageInfo, initialRoleFilter, initialSort]);

  const changeSort = useCallback(
    (next: ComparisonHistoryListSort) => {
      if (next === sort) return;
      void refetchFromStart(next, roleFilter);
    },
    [refetchFromStart, roleFilter, sort],
  );

  const changeRoleFilter = useCallback(
    (next: ComparisonHistoryListRoleFilter) => {
      if (next === roleFilter) return;
      void refetchFromStart(sort, next);
    },
    [refetchFromStart, roleFilter, sort],
  );

  const loadMore = useCallback(async () => {
    if (!pageInfo.nextCursor || loadMoreInFlight.current || listLoading) return;
    loadMoreInFlight.current = true;
    setLoadMoreLoading(true);
    setError(null);
    try {
      const p = buildDocumentComparisonsListSearchParams({
        limit,
        sort,
        roleFilter,
        cursor: pageInfo.nextCursor,
      });
      const res = await fetch(`/api/documents/${documentId}/comparisons?${p.toString()}`, {
        credentials: "same-origin",
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !isListResponse(body)) {
        setError("더 불러오지 못했습니다.");
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.comparison_id));
        const next = body.items.filter((x) => !seen.has(x.comparison_id));
        return [...prev, ...next];
      });
      setPageInfo(body.pageInfo);
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setLoadMoreLoading(false);
      loadMoreInFlight.current = false;
    }
  }, [documentId, limit, listLoading, pageInfo.nextCursor, roleFilter, sort]);

  const resetToDefaults = useCallback(() => {
    void refetchFromStart("created_at_desc", "all");
  }, [refetchFromStart]);

  return {
    items,
    pageInfo,
    sort,
    roleFilter,
    listLoading,
    loadMoreLoading,
    error,
    changeSort,
    changeRoleFilter,
    loadMore,
    resetToDefaults,
    retry: () => void refetchFromStart(sort, roleFilter),
  };
}
