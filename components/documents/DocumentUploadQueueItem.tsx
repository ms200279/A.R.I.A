"use client";

import Link from "next/link";
import type { Route } from "next";

import type { QueueRow } from "@/hooks/useDocumentUploadQueue";
import { formatParsingErrorHint } from "@/lib/documents/upload-status";

const STATUS_LABEL: Record<QueueRow["status"], string> = {
  queued: "대기",
  uploading: "업로드 중",
  uploaded: "전송 완료",
  processing: "서버 처리 확인 중",
  ready: "완료",
  failed: "실패",
  canceled: "취소됨",
  timeout: "응답 지연",
};

type Props = {
  row: QueueRow;
  onRemoveQueued?: (id: string) => void;
  onCancelRow?: (id: string) => void;
  onRetryPoll?: (id: string) => void;
  onRefreshList?: () => void;
};

export default function DocumentUploadQueueItem({
  row,
  onRemoveQueued,
  onCancelRow,
  onRetryPoll,
  onRefreshList,
}: Props) {
  const snap = row.snapshot;
  const errCode = snap ? formatParsingErrorHint(snap.parsing_error_code) : null;
  const canCancel =
    row.status === "uploading" || row.status === "uploaded" || row.status === "processing";
  const showRetry = row.status === "timeout";

  return (
    <li className="rounded-[var(--radius-md)] border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{row.file.name}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {(row.file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            {STATUS_LABEL[row.status]}
          </span>
          {row.status === "queued" && onRemoveQueued ? (
            <button
              type="button"
              onClick={() => onRemoveQueued(row.id)}
              className="text-[10px] text-[var(--text-tertiary)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
            >
              제거
            </button>
          ) : null}
          {canCancel && onCancelRow ? (
            <button
              type="button"
              onClick={() => onCancelRow(row.id)}
              className="text-[10px] text-amber-200/90 underline-offset-2 hover:underline"
            >
              취소
            </button>
          ) : null}
        </div>
      </div>

      {row.duplicateOf ? (
        <p className="mt-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100/95">
          동일한 내용의 파일이 이미 있습니다. 그래도 새로 올리면 별도 문서가 생성될 수 있습니다.{" "}
          <Link
            href={`/documents/${row.duplicateOf.id}` as Route}
            className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            기존 문서 보기
          </Link>
        </p>
      ) : null}

      {row.progress === null ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="status"
          aria-label="서버 처리 중, 진행률은 표시하지 않습니다"
        >
          <div className="h-full w-full animate-pulse bg-[var(--accent)]/35" />
        </div>
      ) : (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={row.progress}
          aria-label={`${row.file.name} 업로드 진행률 ${row.progress}%`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              row.status === "failed" || row.status === "timeout"
                ? "bg-red-400/80"
                : row.status === "canceled"
                  ? "bg-white/25"
                  : "bg-[var(--accent)]"
            }`}
            style={{ width: `${row.progress}%` }}
          />
        </div>
      )}

      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
        {row.status === "uploading"
          ? "브라우저에서 서버로 파일 전송 중"
          : row.status === "uploaded"
            ? "서버에 수신됨. 처리 상태를 확인합니다"
            : row.status === "processing"
              ? "파싱·전처리·요약 파이프라인 상태를 주기적으로 확인합니다(백오프)"
              : row.status === "ready"
                ? "문서를 사용할 수 있습니다"
                : row.status === "timeout"
                  ? "아직 끝나지 않았을 수 있습니다. 실패가 아닐 수 있습니다."
                  : row.status === "canceled"
                    ? row.errorMessage ?? "취소됨"
                    : row.status === "failed"
                      ? row.errorMessage ?? "오류"
                      : "업로드 대기 중"}
      </p>

      {snap ? (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] uppercase tracking-wide">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
            행 {snap.status}
          </span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
            파싱 {snap.parsing_status ?? "—"}
          </span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
            전처리 {snap.preprocessing_status ?? "—"}
          </span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
            요약 {snap.summary_status ?? "—"}
          </span>
          {errCode ? (
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 normal-case text-red-200/90">
              {errCode}
            </span>
          ) : null}
          <span className="normal-case text-[var(--text-tertiary)]">
            갱신 {new Date(snap.updated_at).toLocaleString("ko-KR")}
          </span>
        </div>
      ) : null}

      {row.errorMessage && row.status !== "canceled" ? (
        <p className="mt-2 text-[11px] text-red-200/90">{row.errorMessage}</p>
      ) : row.status === "canceled" && row.errorMessage ? (
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">{row.errorMessage}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {row.documentId ? (
          <Link
            href={`/documents/${row.documentId}` as Route}
            className="text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            문서 상세 →
          </Link>
        ) : null}
        {showRetry && onRetryPoll ? (
          <button
            type="button"
            onClick={() => onRetryPoll(row.id)}
            className="text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            다시 확인
          </button>
        ) : null}
        {showRetry && onRefreshList ? (
          <button
            type="button"
            onClick={onRefreshList}
            className="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            목록 새로고침
          </button>
        ) : null}
      </div>
    </li>
  );
}
