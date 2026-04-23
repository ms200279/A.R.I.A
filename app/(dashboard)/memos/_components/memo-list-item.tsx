import Link from "next/link";
import type { Route } from "next";

import type { Memo } from "@/types/memo";

export default function MemoListItem({ memo }: { memo: Memo }) {
  const preview = (memo.summary ?? memo.content).trim().slice(0, 220);
  return (
    <article className="rounded border border-black/10 p-4 text-sm dark:border-white/10">
      <header className="mb-1 flex items-start justify-between gap-3">
        <Link
          href={`/memos/${memo.id}` as Route}
          className="font-medium underline-offset-2 hover:underline"
        >
          {memo.title?.trim() || "(제목 없음)"}
        </Link>
        <div className="flex items-center gap-2 text-[11px] opacity-60">
          {memo.sensitivity_flag && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              민감
            </span>
          )}
          <span>{new Date(memo.created_at).toLocaleDateString()}</span>
        </div>
      </header>
      <p className="whitespace-pre-wrap break-words opacity-80">{preview}</p>
    </article>
  );
}
