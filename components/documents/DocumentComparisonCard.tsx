import {
  comparisonAnchorRoleBadgeLabel,
  comparisonAnchorRoleUiTier,
} from "@/lib/documents/comparison-anchor-role";
import type { DocumentDetailComparisonBlock } from "@/types/document-ui";

import { ComparisonResultBody, formatComparisonWhen } from "./comparison-display-utils";
import DocumentEmptyState from "./DocumentEmptyState";

type Props = {
  latest: DocumentDetailComparisonBlock | null;
};

/**
 * 비교 결과는 JSON(구조화) 또는 평문으로 저장될 수 있다. 본문은 ComparisonResultBody 와 공유.
 * read-side latest는 정책 A: 이 문서가 primary/peer/secondary 등으로 참여한 히스토리·레거시 중 가장 최신 1건.
 */
export default function DocumentComparisonCard({ latest }: Props) {
  if (!latest?.content?.trim()) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-medium text-[var(--text-primary)]">비교</h2>
        <DocumentEmptyState
          title="아직 비교 결과가 없습니다"
          description="이 문서를 포함한 비교가 있으면(앵커/피어) 최신 1건이 여기에 표시됩니다. 히스토리나 저장 조건이 맞지 않으면 비어 있을 수 있습니다."
        />
      </section>
    );
  }

  const role = comparisonAnchorRoleBadgeLabel(latest.current_document_anchor_role);
  const roleTier = comparisonAnchorRoleUiTier(latest.current_document_anchor_role);
  const showRelated =
    Boolean(latest.related_documents_preview?.trim()) &&
    latest.related_documents_preview !== "—";

  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium text-[var(--text-primary)]">비교</h2>
      <article className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-elevated)]/60 p-4 shadow-sm shadow-black/20">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="rounded-md bg-[var(--warning-soft)] px-2 py-0.5 text-[var(--warning)]">
            {latest.summary_type}
          </span>
          <time dateTime={latest.created_at}>{formatComparisonWhen(latest.created_at)}</time>
          <span
            className={
              roleTier === "primary"
                ? "rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-200/90"
                : roleTier === "supporting"
                  ? "rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[var(--text-secondary)]"
                  : "rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[var(--text-tertiary)]"
            }
          >
            {role.label}
          </span>
        </div>
        {showRelated ? (
          <p className="mb-3 line-clamp-2 text-xs text-[var(--text-tertiary)]">
            함께 비교: {latest.related_documents_preview}
          </p>
        ) : null}

        <ComparisonResultBody content={latest.content} />
      </article>
    </section>
  );
}
