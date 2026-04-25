import type { DocumentDetailLatestBlock } from "@/types/document-ui";

import { ComparisonResultBody, formatComparisonWhen } from "./comparison-display-utils";
import DocumentEmptyState from "./DocumentEmptyState";

type Props = {
  latest: DocumentDetailLatestBlock | null;
};

/**
 * 비교 결과는 JSON(구조화) 또는 평문으로 저장될 수 있다. 본문은 ComparisonResultBody 와 공유.
 */
export default function DocumentComparisonCard({ latest }: Props) {
  if (!latest?.content?.trim()) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-medium text-[var(--text-primary)]">비교</h2>
        <DocumentEmptyState
          title="아직 비교 결과가 없습니다"
          description="이 문서를 앵커로 저장된 비교(comparison)가 있으면 여기에 표시됩니다. 다른 문서만 비교에 참여한 경우 이 카드는 비어 있을 수 있습니다."
        />
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium text-[var(--text-primary)]">비교</h2>
      <article className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-elevated)]/60 p-4 shadow-sm shadow-black/20">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="rounded-md bg-[var(--warning-soft)] px-2 py-0.5 text-[var(--warning)]">
            {latest.summary_type}
          </span>
          <time dateTime={latest.created_at}>{formatComparisonWhen(latest.created_at)}</time>
        </div>

        <ComparisonResultBody content={latest.content} />
      </article>
    </section>
  );
}
