import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { getMemo } from "@/lib/memos";

import SummarizeButton from "./_components/summarize-button";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function MemoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const memo = await getMemo(id);
  if (!memo) notFound();

  return (
    <section className="space-y-6">
      <nav className="text-xs opacity-60">
        <Link href={"/memos" as Route} className="underline-offset-2 hover:underline">
          ← 메모 목록
        </Link>
      </nav>
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">
            {memo.title?.trim() || "(제목 없음)"}
          </h2>
          {memo.sensitivity_flag && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              민감정보 의심
            </span>
          )}
        </div>
        <p className="text-xs opacity-60">
          저장 시각 {new Date(memo.created_at).toLocaleString()} · source={memo.source_type}
          {memo.project_key ? ` · project=${memo.project_key}` : ""}
        </p>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">요약</h3>
          <SummarizeButton memoId={memo.id} hasSummary={!!memo.summary} />
        </div>
        {memo.summary ? (
          <p className="whitespace-pre-wrap break-words rounded border border-black/10 p-3 text-sm dark:border-white/10">
            {memo.summary}
          </p>
        ) : (
          <p className="rounded border border-dashed border-black/10 p-3 text-xs opacity-60 dark:border-white/10">
            아직 요약이 없습니다. 우측 버튼으로 규칙 기반 요약을 생성할 수 있습니다.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">본문</h3>
        <pre className="whitespace-pre-wrap break-words rounded border border-black/10 p-3 text-sm dark:border-white/10">
          {memo.content}
        </pre>
      </section>
    </section>
  );
}
