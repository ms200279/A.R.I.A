import Link from "next/link";
import type { Route } from "next";

import { displayMemoTitle } from "@/lib/memos/display";
import type { Memo } from "@/types/memo";

function formatLine(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function MemoListItem({ memo }: { memo: Memo }) {
  const displayTitle = displayMemoTitle(memo);
  const preview = (memo.summary ?? memo.content).trim().slice(0, 220);
  return (
    <article className="rounded border border-white/10 bg-white/[0.02] p-4 text-sm">
      <header className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/memos/${memo.id}` as Route}
            className="block font-medium text-[var(--text-primary)] underline-offset-2 hover:underline"
          >
            {displayTitle}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            {memo.project_key && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                {memo.project_key}
              </span>
            )}
            <span>만든 날: {formatLine(memo.created_at)}</span>
            <span>·</span>
            <span>수정: {formatLine(memo.updated_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
          {memo.sensitivity_flag && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              민감
            </span>
          )}
        </div>
      </header>
      <p className="whitespace-pre-wrap break-words text-[var(--text-secondary)]">{preview}</p>
    </article>
  );
}
