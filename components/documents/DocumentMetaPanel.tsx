import type { DocumentMetaPanelModel } from "@/types/document-ui";

function formatWhen(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentMetaPanel({ meta }: { meta: DocumentMetaPanelModel }) {
  const displayTitle = meta.title?.trim() || meta.file_name || "문서";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{displayTitle}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {meta.file_name ?? "—"} · {meta.file_type ?? "—"} · {formatSize(meta.file_size)} · source:{" "}
          {meta.source}
        </p>
      </header>

      <dl className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-overlay)] p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">파싱</dt>
          <dd className="text-[var(--text-primary)] text-right">{meta.parsing_status ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">전처리</dt>
          <dd className="text-[var(--text-primary)] text-right">
            {meta.preprocessing_status ?? "—"}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">요약 파이프라인</dt>
          <dd className="text-[var(--text-primary)] text-right">{meta.summary_status ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">청크 수</dt>
          <dd className="text-[var(--text-primary)] text-right">{meta.chunk_count}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">생성</dt>
          <dd className="text-[var(--text-primary)] text-right">{formatWhen(meta.created_at)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">수정</dt>
          <dd className="text-[var(--text-primary)] text-right">{formatWhen(meta.updated_at)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">요약 가능</dt>
          <dd className="text-[var(--text-primary)] text-right">
            {meta.can_summarize ? "예" : "아니오"}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[var(--text-tertiary)]">비교 입력 구성 가능</dt>
          <dd className="text-[var(--text-primary)] text-right">
            {meta.can_compare ? "예" : "아니오"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
