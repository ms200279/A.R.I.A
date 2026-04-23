import Link from "next/link";
import type { Route } from "next";

import { createClient } from "@/lib/supabase/server";
import { listMemos, listPendingSaveMemos, searchMemos } from "@/lib/memos";

import QuickCapture from "./_components/quick-capture";
import PendingItem from "./_components/pending-item";
import SearchBox from "./_components/search-box";
import MemoListItem from "./_components/memo-list-item";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string; tag?: string }>;
};

export default async function MemosPage({ searchParams }: PageProps) {
  const { q, tag } = await searchParams;
  const trimmed = (q ?? "").trim();
  const tagTrim = (tag ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const audit =
    user?.id != null
      ? {
          actor_id: user.id,
          actor_email: user.email ?? null,
          source: "rsc" as const,
        }
      : undefined;

  const pending = await listPendingSaveMemos();
  const memoResult = trimmed
    ? await searchMemos({
        query: trimmed,
        tag: tagTrim,
        audit,
      })
    : await listMemos({
        sort: "updated_at",
        project_key: tagTrim,
        audit,
      });
  const items = memoResult.items;

  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">메모</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            저장은 승인 후에만 반영됩니다. 조회·검색·요약은 자동으로 가능합니다. 프로젝트(태그)는
            <code className="mx-0.5 rounded bg-white/10 px-1">project_key</code>로 저장·필터됩니다.
          </p>
        </div>

        <QuickCapture />

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            승인 대기 ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-[var(--text-tertiary)]">
              현재 승인 대기 중인 메모 저장 요청이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((item) => (
                <li key={item.id}>
                  <PendingItem item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              저장된 메모
              {trimmed ? ` — 검색 “${trimmed}”` : ""}
              {tagTrim ? ` — 프로젝트 ${tagTrim}` : ""}
            </h3>
            <SearchBox
              initialQuery={trimmed}
              initialProjectKey={tagTrim ?? ""}
            />
          </div>
          {items.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-[var(--text-tertiary)]">
              {trimmed
                ? "검색 결과가 없습니다."
                : "아직 저장된 메모가 없습니다. 위의 빠른 입력으로 첫 메모를 요청해 보세요."}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((memo) => (
                <li key={memo.id}>
                  <MemoListItem memo={memo} />
                </li>
              ))}
            </ul>
          )}
          {(trimmed || tagTrim) && (
            <Link
              href={"/memos" as Route}
              className="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
            >
              검색·필터 해제하고 전체 목록 보기
            </Link>
          )}
        </section>
      </section>
    </div>
  );
}
