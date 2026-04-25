import Link from "next/link";
import type { Route } from "next";

import { comparisonAnchorRoleBadgeLabel } from "@/lib/documents/comparison-anchor-role";
import type { ComparisonHistoryDetailPayload } from "@/types/document";

import { ComparisonResultBody, formatComparisonWhen } from "./comparison-display-utils";

type Props = {
  data: ComparisonHistoryDetailPayload;
  /** 문서 상세에서 넘어온 맥락 문서 id — 목록에서 강조 */
  contextDocumentId?: string | null;
};

export default function ComparisonHistoryDetailView({ data, contextDocumentId }: Props) {
  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-[var(--border-subtle)] pb-6">
        <p className="font-mono text-xs text-[var(--text-tertiary)]">{data.comparison_id}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <time dateTime={data.created_at}>생성 {formatComparisonWhen(data.created_at)}</time>
          {data.summary_id ? (
            <>
              <span>·</span>
              <span className="text-[var(--text-tertiary)]">
                summary_id:{" "}
                <span className="font-mono text-[var(--text-secondary)]">{data.summary_id}</span>
              </span>
            </>
          ) : null}
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          primary 앵커 문서 ID:{" "}
          <span className="font-mono text-[var(--text-secondary)]">{data.primary_document_id}</span>
        </p>
        {data.current_context ? (
          <p className="text-xs text-[var(--text-secondary)]">
            이 문서의 비교 역할:{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {comparisonAnchorRoleBadgeLabel(data.current_context.anchor_role).label}
            </span>
            {data.current_context.sort_order != null ? (
              <span className="text-[var(--text-tertiary)]">
                {" "}
                · 순서 {data.current_context.sort_order}
              </span>
            ) : null}
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-[var(--text-primary)]">포함된 문서</h2>
        <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-overlay)]">
          {[...data.documents]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((doc) => {
              const highlighted = contextDocumentId && doc.id === contextDocumentId;
              const roleBadge = comparisonAnchorRoleBadgeLabel(doc.anchor_role);
              return (
                <li
                  key={doc.id}
                  className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${
                    highlighted ? "bg-[var(--accent-soft)]/30" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/documents/${doc.id}` as Route}
                      className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
                    >
                      {doc.title?.trim() || doc.file_name || doc.id.slice(0, 8) + "…"}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                      {doc.file_name ?? "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        roleBadge.kind === "known" && roleBadge.role === "primary"
                          ? "rounded bg-[var(--warning-soft)] px-2 py-0.5 text-[var(--warning)]"
                          : roleBadge.kind === "known"
                            ? "rounded bg-white/5 px-2 py-0.5 text-[var(--text-secondary)]"
                            : "rounded bg-white/5 px-2 py-0.5 text-[var(--text-tertiary)]"
                      }
                    >
                      {roleBadge.label}
                    </span>
                    <span className="text-[var(--text-tertiary)]">sort {doc.sort_order}</span>
                    {highlighted ? (
                      <span className="text-[var(--accent-strong)]">← 보고 있던 문서</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-[var(--text-primary)]">비교 결과</h2>
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-elevated)]/50 p-4">
          <p className="mb-2 text-xs text-[var(--text-tertiary)]">
            긴 내용은 아래 영역에서 스크롤할 수 있습니다.
          </p>
          <div className="max-h-[min(70vh,36rem)] overflow-y-auto pr-1">
            <ComparisonResultBody content={data.content} />
          </div>
        </article>
      </section>
    </div>
  );
}
