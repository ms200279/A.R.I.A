"use client";

import Link from "next/link";
import type { Route } from "next";

import ComparisonHistoryListItemBlock from "@/components/documents/ComparisonHistoryListItemBlock";
import { formatComparisonWhen } from "@/components/documents/comparison-display-utils";
import type {
  AssistantComparisonHistoryItemAttachment,
  DocumentLatestComparisonCardAttachment,
} from "@/types/assistant-attachments";

import DocumentCardShell from "./DocumentCardShell";

type Props = {
  data: AssistantComparisonHistoryItemAttachment | DocumentLatestComparisonCardAttachment;
};

export default function DocumentComparisonInlineCard({ data }: Props) {
  if (data.kind === "comparison_history_item") {
    const detailHref =
      `/comparisons/${data.item.comparison_id}?from=${encodeURIComponent(data.context_document_id)}` as Route;
    return (
      <DocumentCardShell
        variant="comparison"
        eyebrow="문서 비교 결과"
        actions={
          <>
            <Link
              href={detailHref}
              className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-100/95 hover:bg-amber-500/30"
            >
              비교 보기
            </Link>
            <Link
              href={`/documents/${data.context_document_id}` as Route}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-white/20"
            >
              문서 상세
            </Link>
          </>
        }
      >
        <ComparisonHistoryListItemBlock
          item={data.item}
          variant="card"
        />
      </DocumentCardShell>
    );
  }

  const title = data.documentTitle?.trim() || "문서";
  const primaryHref = (
    data.comparisonHistoryId ? `/comparisons/${data.comparisonHistoryId}` : `/documents/${data.documentId}`
  ) as Route;

  return (
    <DocumentCardShell
      variant="comparison"
      eyebrow="문서 비교 결과"
      actions={
        <>
          <Link
            href={primaryHref}
            className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-100/95 hover:bg-amber-500/30"
          >
            {data.comparisonHistoryId ? "비교 보기" : "문서에서 보기"}
          </Link>
          <Link
            href={`/documents/${data.documentId}` as Route}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-white/20"
          >
            문서 상세
          </Link>
        </>
      }
    >
      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">{title}</p>
      {data.createdAt ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          {formatComparisonWhen(data.createdAt)}
        </p>
      ) : null}
      <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        {data.contentPreview || "—"}
      </p>
      {data.relatedDocumentIds && data.relatedDocumentIds.length > 0 ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          관련 문서 id:{" "}
          <span className="font-mono">
            {data.relatedDocumentIds.map((id) => id.slice(0, 8)).join(", ")}
          </span>
        </p>
      ) : null}
    </DocumentCardShell>
  );
}
