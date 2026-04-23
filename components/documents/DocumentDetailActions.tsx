"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  documentId: string;
  canSummarize: boolean;
  /** 비교 링크 툴팁·향후 버튼 활성화에 사용 */
  canCompare: boolean;
};

export default function DocumentDetailActions({ documentId, canSummarize, canCompare }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"summarize" | "analyze" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runSummarize = useCallback(async () => {
    setMessage(null);
    setBusy("summarize");
    try {
      const res = await fetch(`/api/documents/${documentId}/summarize?mode=regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "요약 요청에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }, [documentId, router]);

  const runAnalyze = useCallback(async () => {
    setMessage(null);
    setBusy("analyze");
    try {
      const res = await fetch(`/api/documents/${documentId}/analyze`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "분석 요청에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }, [documentId, router]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-overlay)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        동작
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runSummarize}
          disabled={!canSummarize || busy !== null}
          className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-strong)] hover:bg-[var(--accent)]/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "summarize" ? "요약 중…" : "요약 생성·재생성"}
        </button>
        <button
          type="button"
          onClick={runAnalyze}
          disabled={!canSummarize || busy !== null}
          className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "analyze" ? "분석 중…" : "분석 실행"}
        </button>
        <Link
          href={"/documents" as Route}
          className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          title={
            canCompare
              ? "문서 목록으로 이동합니다. 비교는 API/어시스턴트에서 두 개 이상의 ID로 실행합니다."
              : "이 문서는 아직 비교 입력으로 쓰기 어렵습니다. 목록에서 다른 문서를 확인하세요."
          }
        >
          비교하러 가기
        </Link>
      </div>
      {!canSummarize ? (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          파싱·전처리가 완료되고 본문이 준비되면 요약·분석을 실행할 수 있습니다.
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
