import Link from "next/link";
import type { Route } from "next";

import { displayMemoTitle } from "@/lib/memos/display";
import type { SaveMemoPendingOutcome } from "@/types/pending-action";

function memoIdFromResult(result: unknown): string | null {
  if (
    result &&
    typeof result === "object" &&
    (result as { kind?: string }).kind === "memo_saved"
  ) {
    const id = (result as { memo_id?: string }).memo_id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function statusLabel(status: SaveMemoPendingOutcome["status"]) {
  switch (status) {
    case "executed":
      return { text: "저장됨", className: "bg-emerald-500/15 text-emerald-200" };
    case "rejected":
      return { text: "거절됨", className: "bg-white/10 text-[var(--text-tertiary)]" };
    case "blocked":
      return { text: "차단됨", className: "bg-amber-500/15 text-amber-200" };
  }
}

export default function RecentPendingOutcomes({
  items,
}: {
  items: SaveMemoPendingOutcome[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        최근 처리됨 (승인·거절·차단)
      </h3>
      <ul className="space-y-2">
        {items.map((o) => {
          const title = displayMemoTitle({
            title: o.payload.title,
            content: o.payload.content,
          });
          const badge = statusLabel(o.status);
          const memoId = o.status === "executed" ? memoIdFromResult(o.result) : null;
          return (
            <li
              key={o.id}
              className="rounded border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                >
                  {badge.text}
                </span>
                {memoId ? (
                  <Link
                    href={`/memos/${memoId}` as Route}
                    className="font-medium text-[var(--text-primary)] underline-offset-2 hover:underline"
                  >
                    {title}
                  </Link>
                ) : (
                  <span className="font-medium text-[var(--text-primary)]">{title}</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                처리 {new Date(o.updated_at).toLocaleString()}
                {o.status === "blocked" && o.blocked_reason
                  ? ` · 사유: ${o.blocked_reason}`
                  : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
