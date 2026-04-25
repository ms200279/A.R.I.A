"use client";

import Link from "next/link";
import type { Route } from "next";

import { formatComparisonWhen } from "@/components/documents/comparison-display-utils";
import { comparisonAnchorRoleBadgeLabel } from "@/lib/documents/comparison-anchor-role";
import type { AssistantComparisonDetailAttachment } from "@/types/comparisons";

import DocumentCardShell from "./DocumentCardShell";

const PREVIEW_MAX = 320;

type Props = { data: AssistantComparisonDetailAttachment };

export default function DocumentComparisonDetailInlineCard({ data }: Props) {
  const { data: d, context_document_id } = data;
  const href =
    `/comparisons/${d.comparison_id}?from=${encodeURIComponent(context_document_id)}` as Route;
  const body = d.content.trim();
  const preview =
    body.length > PREVIEW_MAX ? `${body.slice(0, PREVIEW_MAX - 1)}…` : body;

  const selfDoc = d.documents.find((x) => x.id === context_document_id);
  const roleLabel = selfDoc
    ? comparisonAnchorRoleBadgeLabel(selfDoc.anchor_role).label
    : d.current_context
      ? comparisonAnchorRoleBadgeLabel(d.current_context.anchor_role).label
      : null;

  return (
    <DocumentCardShell
      variant="comparison"
      eyebrow="비교 상세"
      actions={
        <>
          <Link
            href={href}
            className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-100/95 hover:bg-amber-500/30"
          >
            전체 보기
          </Link>
          <Link
            href={`/documents/${context_document_id}` as Route}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-white/20"
          >
            문서 상세
          </Link>
        </>
      }
    >
      <p className="text-[10px] text-[var(--text-tertiary)]">
        {formatComparisonWhen(d.created_at)}
        {roleLabel ? (
          <span className="text-[var(--text-secondary)]"> · 맥락 역할 {roleLabel}</span>
        ) : null}
      </p>
      <p className="line-clamp-4 text-xs leading-relaxed text-[var(--text-secondary)]">{preview || "—"}</p>
      {d.documents.length > 0 ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          포함 {d.documents.length}개 문서
        </p>
      ) : null}
    </DocumentCardShell>
  );
}
