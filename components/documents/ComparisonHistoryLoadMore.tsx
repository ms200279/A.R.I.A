"use client";

import { useState } from "react";

import type {
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListPageInfo,
  ComparisonHistoryListSort,
} from "@/types/comparisons";

import DocumentComparisonHistoryItem from "./DocumentComparisonHistoryItem";

type Props = {
  documentId: string;
  initialItems: ComparisonHistoryListItemPayload[];
  initialPageInfo: ComparisonHistoryListPageInfo;
  /** API `sort` 와 동기(기본 최신순). */
  sort?: ComparisonHistoryListSort;
};

function isListResponse(body: unknown): body is {
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
} {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return Array.isArray(o.items) && o.pageInfo !== null && typeof o.pageInfo === "object";
}

/**
 * 첫 페이지는 RSC에서 내려주고, `pageInfo.hasMore` 일 때 다음 커서로 append.
 */
export default function ComparisonHistoryLoadMore({
  documentId,
  initialItems,
  initialPageInfo,
  sort = "created_at_desc",
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadMore = async () => {
    if (!pageInfo.nextCursor || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const p = new URLSearchParams();
      p.set("limit", "20");
      p.set("sort", sort);
      p.set("cursor", pageInfo.nextCursor);
      const res = await fetch(`/api/documents/${documentId}/comparisons?${p.toString()}`, {
        credentials: "same-origin",
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !isListResponse(body)) {
        setErr("더 불러오지 못했습니다.");
        return;
      }
      setItems((prev) => [...prev, ...body.items]);
      setPageInfo(body.pageInfo);
    } catch {
      setErr("네트워크 오류입니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ul className="space-y-3">
        {items.map((item) => (
          <DocumentComparisonHistoryItem
            key={item.comparison_id}
            item={item}
            contextDocumentId={documentId}
          />
        ))}
      </ul>
      {pageInfo.hasMore ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-[var(--radius-md)] border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-[var(--text-secondary)] hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "불러오는 중…" : "더 보기"}
          </button>
          {err ? (
            <p className="mt-1 text-xs text-red-300/90" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
