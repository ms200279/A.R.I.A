import Link from "next/link";
import type { Route } from "next";

import { listMemos, listPendingSaveMemos, searchMemos } from "@/lib/memos";

import QuickCapture from "./_components/quick-capture";
import PendingItem from "./_components/pending-item";
import SearchBox from "./_components/search-box";
import MemoListItem from "./_components/memo-list-item";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function MemosPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const trimmed = (q ?? "").trim();

  const pending = await listPendingSaveMemos();
  const memoResult = trimmed
    ? await searchMemos({ query: trimmed })
    : await listMemos();
  const items = "items" in memoResult ? memoResult.items : [];

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">메모</h2>
        <p className="text-sm opacity-75">
          저장은 언제나 승인 후에만 실행됩니다. 민감정보가 섞여 있다고 판단되면 확인 문구가 표시됩니다.
        </p>
      </div>

      <QuickCapture />

      <section className="space-y-3">
        <h3 className="text-base font-semibold">승인 대기 ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="rounded border border-black/10 p-4 text-sm opacity-60 dark:border-white/10">
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
          <h3 className="text-base font-semibold">
            저장된 메모 {trimmed ? `— 검색: "${trimmed}"` : ""}
          </h3>
          <SearchBox initialQuery={trimmed} />
        </div>
        {items.length === 0 ? (
          <p className="rounded border border-black/10 p-4 text-sm opacity-60 dark:border-white/10">
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
        {trimmed && (
          <Link href={"/memos" as Route} className="text-xs underline-offset-2 hover:underline">
            검색 해제하고 전체 목록 보기
          </Link>
        )}
      </section>
    </section>
  );
}
