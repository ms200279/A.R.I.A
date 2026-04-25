import { tryParseCompareResult } from "@/lib/documents/parse-stored-document-results";

export function formatComparisonWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

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
 * 저장된 비교 content(JSON 또는 평문) 공통 렌더링. 카드·히스토리 상세에서 재사용.
 */
export function ComparisonResultBody({ content }: { content: string }) {
  const parsed = tryParseCompareResult(content);

  if (parsed) {
    return (
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
    );
  }

  return (
    <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">
      {content}
    </div>
  );
}
