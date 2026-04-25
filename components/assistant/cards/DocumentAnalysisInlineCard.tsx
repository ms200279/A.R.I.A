"use client";

import Link from "next/link";
import type { Route } from "next";

import { formatComparisonWhen } from "@/components/documents/comparison-display-utils";
import type { DocumentLatestAnalysisCardAttachment } from "@/types/assistant-attachments";

import DocumentCardShell from "./DocumentCardShell";

type Props = { data: DocumentLatestAnalysisCardAttachment };

export default function DocumentAnalysisInlineCard({ data }: Props) {
  const title = data.documentTitle?.trim() || "문서";

  return (
    <DocumentCardShell
      variant="analysis"
      eyebrow="문서 분석"
      actions={
        <Link
          href={`/documents/${data.documentId}` as Route}
          className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-[11px] font-medium text-sky-100/95 hover:bg-sky-500/30"
        >
          문서에서 보기
        </Link>
      }
    >
      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">{title}</p>
      {data.createdAt ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          {formatComparisonWhen(data.createdAt)}
        </p>
      ) : null}
      {data.keyPoints && data.keyPoints.length > 0 ? (
        <ul className="list-inside list-disc text-[11px] text-[var(--text-secondary)]">
          {data.keyPoints.map((kp, i) => (
            <li key={i} className="line-clamp-2">
              {kp}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        {data.contentPreview || "—"}
      </p>
    </DocumentCardShell>
  );
}
