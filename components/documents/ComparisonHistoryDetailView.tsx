import ComparisonActionBar from "@/components/comparisons/ComparisonActionBar";
import ComparisonDetailDocumentsPanel from "@/components/comparisons/ComparisonDetailDocumentsPanel";
import { comparisonAnchorRoleBadgeLabel } from "@/lib/documents/comparison-anchor-role";
import type { ComparisonHistoryDetailPayload } from "@/types/document";

import { ComparisonResultBody, formatComparisonWhen } from "./comparison-display-utils";

type Props = {
  data: ComparisonHistoryDetailPayload;
  /** 문서 상세에서 넘어온 맥락 문서 id — 목록에서 강조 */
  contextDocumentId?: string | null;
  isBookmarked: boolean;
};

export default function ComparisonHistoryDetailView({
  data,
  contextDocumentId,
  isBookmarked,
}: Props) {
  return (
    <div className="space-y-8">
      <header className="space-y-4 border-b border-[var(--border-subtle)] pb-6">
        <p className="font-mono text-xs text-[var(--text-tertiary)]">{data.comparison_id}</p>
        <ComparisonActionBar
          comparisonId={data.comparison_id}
          fromDocumentId={contextDocumentId ?? null}
          primaryDocumentId={data.primary_document_id}
          initialIsBookmarked={isBookmarked}
        />
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

      <ComparisonDetailDocumentsPanel
        documents={data.documents}
        contextDocumentId={contextDocumentId}
      />

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
