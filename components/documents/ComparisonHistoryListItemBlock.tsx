import type { ReactNode } from "react";

import { comparisonAnchorRoleBadgeLabel } from "@/lib/documents/comparison-anchor-role";
import type { ComparisonHistoryListItemPayload } from "@/types/comparisons";

import { formatComparisonWhen } from "./comparison-display-utils";

type Props = {
  item: ComparisonHistoryListItemPayload;
  /** 카드(assistant)는 타이틀/여백을 약간 줄인다. */
  variant?: "list" | "card";
  /** meta 줄 앞/뒤에 끼워 넣을 슬롯(선택). */
  extraLeadingMeta?: ReactNode;
};

/**
 * 문서 상세 히스토리 목록·assistant 카드가 공유하는 본문( preview · role · 다른 문서 ).
 */
export default function ComparisonHistoryListItemBlock({
  item,
  variant = "list",
  extraLeadingMeta,
}: Props) {
  const roleBadge = comparisonAnchorRoleBadgeLabel(item.current_document_anchor_role);
  const textSize = variant === "card" ? "text-xs" : "text-sm";

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div
        className={`flex flex-wrap items-center gap-2 ${
          variant === "card" ? "text-[10px]" : "text-xs"
        } text-[var(--text-tertiary)]`}
      >
        {extraLeadingMeta}
        <time dateTime={item.created_at}>{formatComparisonWhen(item.created_at)}</time>
        <span>·</span>
        <span>{item.document_count}개 문서</span>
        <span>·</span>
        {roleBadge.kind === "known" && roleBadge.role === "primary" ? (
          <span className="rounded bg-[var(--warning-soft)]/80 px-1.5 py-0.5 text-[var(--warning)]">
            {roleBadge.label}
          </span>
        ) : roleBadge.kind === "known" ? (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[var(--text-secondary)]">
            {roleBadge.label}
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">{roleBadge.label}</span>
        )}
        {item.current_document_sort_order != null ? (
          <>
            <span>·</span>
            <span className="text-[var(--text-tertiary)]">순서 {item.current_document_sort_order}</span>
          </>
        ) : null}
      </div>
      <p className={`${textSize} text-[var(--text-secondary)]`}>
        <span className="text-[var(--text-tertiary)]">다른 문서: </span>
        {item.other_documents_preview}
      </p>
      <p
        className={`${
          variant === "card" ? "line-clamp-2 text-xs" : "line-clamp-3 text-sm"
        } leading-relaxed text-[var(--text-tertiary)]`}
      >
        {item.content_preview || "—"}
      </p>
    </div>
  );
}
