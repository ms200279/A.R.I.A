"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { useDocumentUploadQueue } from "@/hooks/useDocumentUploadQueue";

import DocumentUploadDropzone from "./DocumentUploadDropzone";
import DocumentUploadQueue from "./DocumentUploadQueue";

export default function DocumentUploadPanel() {
  const router = useRouter();
  const refreshPending = useRef(false);

  const scheduleRefresh = useCallback(() => {
    if (refreshPending.current) return;
    refreshPending.current = true;
    queueMicrotask(() => {
      refreshPending.current = false;
      router.refresh();
    });
  }, [router]);

  const q = useDocumentUploadQueue(() => {
    scheduleRefresh();
  });

  const busy = q.workerRunning;

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.03] p-5">
      <div className="space-y-1">
        <h3 className="text-base font-medium text-[var(--text-primary)]">문서 업로드</h3>
        <p className="text-xs text-[var(--text-tertiary)]">
          파일은 Storage에 저장되고 텍스트만 추출·청크됩니다. 원문 전체는 목록에 노출되지 않습니다. 여러
          파일은 순차적으로 업로드됩니다.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="doc-upload-title" className="text-xs font-medium text-[var(--text-secondary)]">
          표시 제목 (선택, 큐의 첫 파일에만 적용)
        </label>
        <input
          id="doc-upload-title"
          type="text"
          disabled={busy}
          value={q.optionalTitle}
          onChange={(e) => q.setOptionalTitle(e.target.value)}
          placeholder="비우면 파일 이름에서 제목을 만듭니다"
          className="w-full rounded-[var(--radius-md)] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 disabled:opacity-50"
        />
      </div>

      <DocumentUploadDropzone
        disabled={busy}
        onFiles={(files) => {
          void q.enqueueFiles(files);
        }}
      />

      {q.lastValidationErrors.length > 0 ? (
        <div role="alert" className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
          <p className="font-medium">일부 파일을 건너뛰었습니다</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {q.lastValidationErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <DocumentUploadQueue
        rows={q.rows}
        onRemoveQueued={q.removeQueued}
        onCancelRow={q.cancelRow}
        onRetryPoll={q.retryPoll}
        onRefreshList={scheduleRefresh}
      />

      {q.rows.some((r) =>
        ["ready", "failed", "timeout", "canceled"].includes(r.status),
      ) ? (
        <button
          type="button"
          onClick={() => q.clearTerminal()}
          className="text-xs text-[var(--text-tertiary)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
        >
          완료·실패·지연·취소 항목 지우기
        </button>
      ) : null}
    </section>
  );
}
