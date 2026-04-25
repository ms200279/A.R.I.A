"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { displayMemoListTitle } from "@/lib/memos/display";
import type { MemoListItemPayload } from "@/types/memo";

function formatLine(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const PREVIEW_UI_MAX = 220;

export default function MemoListItem({ memo }: { memo: MemoListItemPayload }) {
  const router = useRouter();
  const [pending, setPending] = useState<"pin" | "mark" | null>(null);
  const [, startTransition] = useTransition();

  const displayTitle = displayMemoListTitle(memo);
  const preview = (memo.summary ?? memo.content_preview).trim().slice(0, PREVIEW_UI_MAX);

  async function patchFlags(patch: { pinned?: boolean; bookmarked?: boolean }) {
    setPending(patch.pinned !== undefined ? "pin" : "mark");
    try {
      const res = await fetch(`/api/memos/${memo.id}/flags`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) return;
      if (!res.ok) return;
      startTransition(() => router.refresh());
    } finally {
      setPending(null);
    }
  }

  return (
    <article className="rounded border border-white/10 bg-white/[0.02] p-4 text-sm">
      <header className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/memos/${memo.id}` as Route}
              className="block font-medium text-[var(--text-primary)] underline-offset-2 hover:underline"
            >
              {displayTitle}
            </Link>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
              저장됨
            </span>
            {memo.pinned && (
              <span className="text-[10px] text-amber-200/90" title="핀">
                핀
              </span>
            )}
            {memo.bookmarked && (
              <span className="text-[10px] text-sky-200/80" title="북마크">
                ★
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            {memo.project_key && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                {memo.project_key}
              </span>
            )}
            {memo.tags?.length > 0 && (
              <span className="text-[10px] text-[var(--text-secondary)]">
                {memo.tags.map((t) => (
                  <span
                    key={t}
                    className="mr-1.5 inline-block rounded border border-white/10 px-1 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
            <span>만든 날: {formatLine(memo.created_at)}</span>
            <span>·</span>
            <span>수정: {formatLine(memo.updated_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-[11px] text-[var(--text-tertiary)]">
          {memo.sensitivity_flag && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              민감
            </span>
          )}
          <button
            type="button"
            title="목록 상단에 두기(읽기용)"
            disabled={!!pending}
            onClick={() => void patchFlags({ pinned: !memo.pinned })}
            className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] hover:bg-white/5 disabled:opacity-50"
          >
            {pending === "pin" ? "…" : memo.pinned ? "핀 해제" : "핀"}
          </button>
          <button
            type="button"
            title="북마크"
            disabled={!!pending}
            onClick={() => void patchFlags({ bookmarked: !memo.bookmarked })}
            className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] hover:bg-white/5 disabled:opacity-50"
          >
            {pending === "mark" ? "…" : memo.bookmarked ? "★" : "☆"}
          </button>
        </div>
      </header>
      <p className="whitespace-pre-wrap break-words text-[var(--text-secondary)]">{preview}</p>
    </article>
  );
}
