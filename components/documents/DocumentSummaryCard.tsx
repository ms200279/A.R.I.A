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

export default function DocumentSummaryCard({ latest }: Props) {
  if (!latest?.content?.trim()) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-medium text-[var(--text-primary)]">요약</h2>
        <DocumentEmptyState
          title="아직 요약이 없습니다"
          description="문서가 파싱·전처리 완료 상태이면 아래에서 요약을 생성할 수 있습니다."
        />
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium text-[var(--text-primary)]">요약</h2>
      <article className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-elevated)]/60 p-4 shadow-sm shadow-black/20">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-strong)]">
            {latest.summary_type}
          </span>
          <time dateTime={latest.created_at}>{formatWhen(latest.created_at)}</time>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span className="font-mono text-[10px] opacity-80">{latest.id.slice(0, 8)}…</span>
        </div>
        <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">
          {latest.content}
        </div>
      </article>
    </section>
  );
}
