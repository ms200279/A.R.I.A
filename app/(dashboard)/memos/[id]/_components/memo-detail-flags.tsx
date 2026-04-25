"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  memoId: string;
  pinned: boolean;
  bookmarked: boolean;
};

export default function MemoDetailFlags({ memoId, pinned, bookmarked }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"p" | "b" | null>(null);
  const [, startTransition] = useTransition();

  async function patch(part: { pinned?: boolean; bookmarked?: boolean }) {
    setBusy(part.pinned !== undefined ? "p" : "b");
    try {
      const res = await fetch(`/api/memos/${memoId}/flags`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(part),
      });
      if (!res.ok) return;
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs text-[var(--text-tertiary)]">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => void patch({ pinned: !pinned })}
        className="rounded border border-white/15 px-2 py-1 hover:bg-white/5 disabled:opacity-50"
      >
        {busy === "p" ? "…" : pinned ? "핀 해제" : "핀"}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => void patch({ bookmarked: !bookmarked })}
        className="rounded border border-white/15 px-2 py-1 hover:bg-white/5 disabled:opacity-50"
      >
        {busy === "b" ? "…" : bookmarked ? "북마크 해제" : "북마크"}
      </button>
    </div>
  );
}
