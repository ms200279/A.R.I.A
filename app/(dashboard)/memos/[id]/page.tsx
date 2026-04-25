import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getMemo } from "@/lib/memos";
import { displayMemoTitle } from "@/lib/memos/display";

import MemoPolicyNotice from "@/components/memos/MemoPolicyNotice";

import SummarizeButton from "./_components/summarize-button";
import MemoDetailFlags from "./_components/memo-detail-flags";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function MemoDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const memo = await getMemo(id, {
    audit:
      user?.id != null
        ? {
            actor_id: user.id,
            actor_email: user.email ?? null,
            source: "rsc",
            log_missing: true,
          }
        : undefined,
  });
  if (!memo) notFound();

  const heading = displayMemoTitle(memo);

  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <nav className="text-xs text-[var(--text-tertiary)]">
          <Link href={"/memos" as Route} className="underline-offset-2 hover:underline">
            ← 메모 목록
          </Link>
        </nav>
        <MemoPolicyNotice />
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{heading}</h2>
            {memo.sensitivity_flag && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                민감정보 의심
              </span>
            )}
            {memo.project_key && (
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                {memo.project_key}
              </span>
            )}
            {memo.tags?.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {memo.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
          </div>
          <MemoDetailFlags memoId={memo.id} pinned={memo.pinned} bookmarked={memo.bookmarked} />
          <p className="text-xs text-[var(--text-tertiary)]">
            생성 {new Date(memo.created_at).toLocaleString()} · 수정{" "}
            {new Date(memo.updated_at).toLocaleString()} · source={memo.source_type}
          </p>
        </header>

        <section className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">요약</h3>
            <SummarizeButton memoId={memo.id} hasSummary={!!memo.summary} />
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            기본은 규칙 기반 요약(rule_based_v1)이며 LLM 으로 교체 가능합니다. 「다시 요약」은 항상
            재생성(<code className="rounded bg-white/10 px-1">regenerate</code>)입니다.
          </p>
          {memo.summary ? (
            <p className="whitespace-pre-wrap break-words rounded border border-white/10 bg-white/[0.02] p-3 text-sm text-[var(--text-secondary)]">
              {memo.summary}
            </p>
          ) : (
            <p className="rounded border border-dashed border-white/15 p-3 text-xs text-[var(--text-tertiary)]">
              아직 요약이 없습니다. 버튼으로 생성하거나 API{" "}
              <code className="rounded bg-white/10 px-1">POST /api/memos/[id]/summarize</code> 의{" "}
              <code className="rounded bg-white/10 px-1">mode=if_empty</code> 로 이미 있을 때 생략할
              수 있습니다.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">본문</h3>
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-[var(--text-secondary)]">
            {memo.content}
          </pre>
        </section>
      </section>
    </div>
  );
}
