"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SummarizeButton({
  memoId,
  hasSummary,
}: {
  memoId: string;
  hasSummary: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/memos/${memoId}/summarize`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) reason = body.error;
      } catch {
        /* keep default */
      }
      setError(reason);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
      >
        {loading ? "요약 생성 중…" : hasSummary ? "다시 요약" : "요약 생성"}
      </button>
    </div>
  );
}
