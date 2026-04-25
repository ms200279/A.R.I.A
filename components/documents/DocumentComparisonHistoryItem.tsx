import Link from "next/link";
import type { Route } from "next";

import type { ComparisonHistoryListItemPayload } from "@/types/comparisons";

import ComparisonHistoryListItemBlock from "./ComparisonHistoryListItemBlock";

type Props = {
  item: ComparisonHistoryListItemPayload;
  /** 문서 상세에서 열 때 맥락(상세에서 하이라이트용 쿼리) */
  contextDocumentId: string;
};

export default function DocumentComparisonHistoryItem({ item, contextDocumentId }: Props) {
  const detailHref =
    `/comparisons/${item.comparison_id}?from=${encodeURIComponent(contextDocumentId)}` as Route;

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-overlay)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ComparisonHistoryListItemBlock item={item} variant="list" />
        <Link
          href={detailHref}
          className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:border-[var(--accent)]/40"
        >
          상세 보기
        </Link>
      </div>
      <p className="mt-2 font-mono text-[10px] text-[var(--text-tertiary)] opacity-80">
        {item.comparison_id}
      </p>
    </li>
  );
}
