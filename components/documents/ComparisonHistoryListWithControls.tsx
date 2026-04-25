"use client";

import { useComparisonHistoryList } from "@/hooks/use-comparison-history-list";
import {
  comparisonHistoryListFilterOptions,
  comparisonHistoryListSortOptions,
  getComparisonHistoryListFilterLabel,
  getComparisonHistoryListSortLabel,
} from "@/lib/documents/comparison-history-list-ui";
import type {
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListPageInfo,
  ComparisonHistoryListRoleFilter,
  ComparisonHistoryListSort,
} from "@/types/comparisons";

import DocumentComparisonHistoryItem from "./DocumentComparisonHistoryItem";
import DocumentEmptyState from "./DocumentEmptyState";

type Props = {
  documentId: string;
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
  initialSort: ComparisonHistoryListSort;
  initialRoleFilter: ComparisonHistoryListRoleFilter;
};

export default function ComparisonHistoryListWithControls({
  documentId,
  items: initialItems,
  pageInfo: initialPageInfo,
  initialSort,
  initialRoleFilter,
}: Props) {
  const {
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
    retry,
  } = useComparisonHistoryList({
    documentId,
    initialItems,
    initialPageInfo,
    initialSort,
    initialRoleFilter,
  });

  const showGlobalEmpty = initialItems.length === 0;
  const showFilteredEmpty = !listLoading && !showGlobalEmpty && items.length === 0;

  return (
    <div className="space-y-3">
      {!showGlobalEmpty ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-[var(--text-tertiary)]">정렬</span>
              <select
                className="rounded border border-[var(--border-soft)] bg-[var(--bg-overlay)] px-2 py-1.5 text-sm text-[var(--text-primary)] disabled:opacity-60"
                value={sort}
                onChange={(e) => changeSort(e.target.value as ComparisonHistoryListSort)}
                disabled={listLoading}
                aria-label="비교 이력 정렬"
              >
                {comparisonHistoryListSortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-[var(--text-tertiary)]">이 문서 역할 필터</span>
              <div
                className="flex flex-wrap gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-0.5"
                role="group"
                aria-label="현재 문서 앵커 역할로 필터"
              >
                {comparisonHistoryListFilterOptions.map((o) => {
                  const active = roleFilter === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      disabled={listLoading}
                      onClick={() => changeRoleFilter(o.value)}
                      className={
                        active
                          ? "rounded-sm bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--on-accent)] disabled:opacity-60"
                          : "rounded-sm px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-60"
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            적용: 정렬 {getComparisonHistoryListSortLabel(sort)} · 필터{" "}
            {getComparisonHistoryListFilterLabel(roleFilter)}
          </p>
        </>
      ) : null}

      {error ? (
        <div
          className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200/95"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void retry()}
            className="ml-2 underline underline-offset-2 hover:text-white"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {listLoading ? (
        <p className="text-sm text-[var(--text-tertiary)]" aria-live="polite">
          목록 불러오는 중…
        </p>
      ) : null}

      {showGlobalEmpty ? (
        <DocumentEmptyState
          title="아직 비교 이력이 없습니다"
          description="문서를 둘 이상 선택해 비교를 실행하면, 이 문서가 참여한 기록이 여기에 쌓입니다."
        />
      ) : showFilteredEmpty ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-soft)] bg-[var(--bg-overlay)]/50 px-4 py-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            선택한 조건에 맞는 비교 이력이 없습니다.
          </p>
          {roleFilter !== "all" || sort !== "created_at_desc" ? (
            <button
              type="button"
              onClick={() => void resetToDefaults()}
              className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              정렬·필터 초기화(최신순·전체)
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3" aria-busy={listLoading || loadMoreLoading}>
          {items.map((item) => (
            <DocumentComparisonHistoryItem
              key={item.comparison_id}
              item={item}
              contextDocumentId={documentId}
            />
          ))}
        </ul>
      )}

      {!showGlobalEmpty && !showFilteredEmpty && pageInfo.hasMore ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadMoreLoading || listLoading || !pageInfo.nextCursor}
            className="rounded-[var(--radius-md)] border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-[var(--text-secondary)] hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadMoreLoading ? "불러오는 중…" : "더 보기"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
