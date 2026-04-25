import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import DocumentUploadPanel from "@/components/documents/DocumentUploadPanel";
import DocumentsListSection from "@/components/documents/DocumentsListSection";
import { listDocuments } from "@/lib/documents/list-documents";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sort?: string }> };

export default async function DocumentsPage({ searchParams }: PageProps) {
  const { sort: sortParam } = await searchParams;
  const sortOpt =
    sortParam === "created_at" || sortParam === "updated_at" ? sortParam : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    notFound();
  }

  const { items, next_cursor, sort } = await listDocuments(supabase, {
    scope_user_id: user.id,
    sort: sortOpt,
    audit: {
      actor_id: user.id,
      actor_email: user.email ?? null,
      source: "rsc",
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">문서</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            업로드한 파일의 메타·요약 상태를 봅니다. 원문 전체는 이 목록에 표시하지 않습니다.
            정렬:{" "}
            <span className="text-[var(--text-tertiary)]">
              {sort === "created_at" ? "생성일" : "수정일"} 내림차순
            </span>
            .
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            정렬은{" "}
            <Link href={"/documents?sort=created_at" as Route} className="text-[var(--accent)] hover:underline">
              생성일
            </Link>
            {" · "}
            <Link href={"/documents?sort=updated_at" as Route} className="text-[var(--accent)] hover:underline">
              수정일
            </Link>
          </p>
        </div>

        <DocumentUploadPanel />

        <DocumentsListSection initialItems={items} initialNextCursor={next_cursor} sort={sort} />
      </section>
    </div>
  );
}
