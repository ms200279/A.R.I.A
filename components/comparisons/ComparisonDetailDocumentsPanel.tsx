"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import {
  comparisonAnchorRoleBadgeLabel,
  comparisonAnchorRoleUiTier,
} from "@/lib/documents/comparison-anchor-role";
import {
  defaultComparisonDetailDocumentsFilterMode,
  defaultComparisonDetailDocumentsSortMode,
  getComparisonDetailDocumentsViewList,
  getComparisonDocumentDisplayLabel,
} from "@/lib/documents/comparison-detail-documents-view";
import type {
  ComparisonDetailDocumentsFilterMode,
  ComparisonDetailDocumentsSortMode,
  ComparisonHistoryDetailPayload,
} from "@/types/document";

const SORT_OPTIONS: { value: ComparisonDetailDocumentsSortMode; label: string }[] = [
  { value: "sort_order_default", label: "기본 (순서·제목)" },
  { value: "title_asc", label: "제목 A→Z" },
  { value: "title_desc", label: "제목 Z→A" },
  { value: "role_priority", label: "역할 우선" },
];

const FILTER_OPTIONS: { value: ComparisonDetailDocumentsFilterMode; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "primary", label: "Primary" },
  { value: "peer", label: "Peer" },
  { value: "secondary", label: "Secondary" },
  { value: "unknown", label: "Unknown" },
];

function sortModeLabel(m: ComparisonDetailDocumentsSortMode): string {
  return SORT_OPTIONS.find((o) => o.value === m)?.label ?? m;
}

function filterModeLabel(m: ComparisonDetailDocumentsFilterMode): string {
  return FILTER_OPTIONS.find((o) => o.value === m)?.label ?? m;
}

function formatSortOrderForRow(n: number): string {
  if (typeof n === "number" && Number.isFinite(n)) {
    return String(n);
  }
  return "—";
}

type Props = {
  documents: ComparisonHistoryDetailPayload["documents"];
  contextDocumentId?: string | null;
};

export default function ComparisonDetailDocumentsPanel({ documents, contextDocumentId }: Props) {
  const [sortMode, setSortMode] = useState<ComparisonDetailDocumentsSortMode>(
    defaultComparisonDetailDocumentsSortMode,
  );
  const [filterMode, setFilterMode] = useState<ComparisonDetailDocumentsFilterMode>(
    defaultComparisonDetailDocumentsFilterMode,
  );

  const viewList = useMemo(
    () => getComparisonDetailDocumentsViewList(documents, filterMode, sortMode),
    [documents, filterMode, sortMode],
  );

  const isEmpty = viewList.length === 0;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-medium text-[var(--text-primary)]">포함된 문서</h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-[var(--text-tertiary)]">정렬</span>
          <select
            className="rounded border border-[var(--border-soft)] bg-[var(--bg-overlay)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as ComparisonDetailDocumentsSortMode)}
            aria-label="문서 정렬"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-[var(--text-tertiary)]">역할 필터</span>
          <div
            className="flex flex-wrap gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-0.5"
            role="group"
            aria-label="앵커 역할로 필터"
          >
            {FILTER_OPTIONS.map((o) => {
              const active = filterMode === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFilterMode(o.value)}
                  className={
                    active
                      ? "rounded-sm bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--on-accent)]"
                      : "rounded-sm px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-white/5"
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
        적용: 정렬 {sortModeLabel(sortMode)} · 필터 {filterModeLabel(filterMode)}
      </p>

      {isEmpty ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-soft)] bg-[var(--bg-overlay)]/50 px-4 py-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            선택한 조건에 맞는 문서가 없습니다.
          </p>
          {filterMode !== "all" ? (
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className="mt-3 text-sm text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              필터를 전체로 돌리기
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-overlay)]">
          {viewList.map((doc) => {
            const highlighted = contextDocumentId && doc.id === contextDocumentId;
            const roleBadge = comparisonAnchorRoleBadgeLabel(doc.anchor_role);
            const roleTier = comparisonAnchorRoleUiTier(doc.anchor_role);
            const displayTitle = getComparisonDocumentDisplayLabel(doc);
            return (
              <li
                key={doc.id}
                className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${
                  highlighted ? "bg-[var(--accent-soft)]/30" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/documents/${doc.id}` as Route}
                    className="line-clamp-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
                  >
                    {displayTitle}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 break-all text-xs text-[var(--text-tertiary)]">
                    {doc.file_name?.trim() || "—"}
                  </p>
                </div>
                <div className="flex max-w-full shrink-0 flex-col items-end gap-1 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span
                    className={
                      roleTier === "primary"
                        ? "rounded bg-[var(--warning-soft)] px-2 py-0.5 text-[var(--warning)]"
                        : roleTier === "supporting"
                          ? "rounded bg-white/5 px-2 py-0.5 text-[var(--text-secondary)]"
                          : "rounded bg-white/5 px-2 py-0.5 text-[var(--text-tertiary)]"
                    }
                  >
                    {roleBadge.label}
                  </span>
                  <span className="shrink-0 text-[var(--text-tertiary)]" title="sort_order">
                    순서 {formatSortOrderForRow(doc.sort_order)}
                  </span>
                  {highlighted ? (
                    <span className="text-[var(--accent-strong)]">← 보고 있던 문서</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
