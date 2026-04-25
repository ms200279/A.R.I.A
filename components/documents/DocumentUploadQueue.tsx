"use client";

import type { QueueRow } from "@/hooks/useDocumentUploadQueue";

import DocumentUploadQueueItem from "./DocumentUploadQueueItem";

type Props = {
  rows: QueueRow[];
  onRemoveQueued: (id: string) => void;
  onCancelRow: (id: string) => void;
  onRetryPoll: (id: string) => void;
  onRefreshList: () => void;
};

export default function DocumentUploadQueue({
  rows,
  onRemoveQueued,
  onCancelRow,
  onRetryPoll,
  onRefreshList,
}: Props) {
  if (!rows.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          업로드 큐 ({rows.length})
        </h4>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <DocumentUploadQueueItem
            key={row.id}
            row={row}
            onRemoveQueued={row.status === "queued" ? onRemoveQueued : undefined}
            onCancelRow={onCancelRow}
            onRetryPoll={onRetryPoll}
            onRefreshList={onRefreshList}
          />
        ))}
      </ul>
    </div>
  );
}
