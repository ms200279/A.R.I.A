import { tryParseCompareResult } from "@/lib/documents/parse-stored-document-results";
import type { DocumentDetailLatestBlock } from "@/types/document-ui";

import DocumentEmptyState from "./DocumentEmptyState";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  latest: DocumentDetailLatestBlock | null;
};

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </h3>
      <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">
        {children}
      </div>
    </div>
  );
}

/**
 * 비교 결과는 JSON(구조화) 또는 평문으로 저장될 수 있다. 이후 비교 히스토리 UI에서 재사용 가능.
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

  const parsed = tryParseCompareResult(latest.content);

  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium text-[var(--text-primary)]">비교</h2>
      <article className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-elevated)]/60 p-4 shadow-sm shadow-black/20">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="rounded-md bg-[var(--warning-soft)] px-2 py-0.5 text-[var(--warning)]">
            {latest.summary_type}
          </span>
          <time dateTime={latest.created_at}>{formatWhen(latest.created_at)}</time>
        </div>

        {parsed ? (
          <div className="space-y-4">
            {parsed.compared_document_ids?.length ? (
              <p className="text-xs text-[var(--text-tertiary)]">
                비교 문서 ID:{" "}
                <span className="font-mono text-[var(--text-secondary)]">
                  {parsed.compared_document_ids.join(", ")}
                </span>
              </p>
            ) : null}
            <FieldBlock label="차이 요약">{parsed.summary_of_differences}</FieldBlock>
            <FieldBlock label="공통점">{parsed.summary_of_common_points}</FieldBlock>
            <FieldBlock label="갈등·누락">{parsed.notable_gaps_or_conflicts}</FieldBlock>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">
            {latest.content}
          </div>
        )}
      </article>
    </section>
  );
}
