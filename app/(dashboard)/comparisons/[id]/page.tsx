import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import ComparisonHistoryDetailView from "@/components/documents/ComparisonHistoryDetailView";
import { getComparisonHistoryDetail } from "@/lib/documents/get-comparison-history";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function ComparisonDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const contextDocumentId = (from ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    notFound();
  }

  const result = await getComparisonHistoryDetail(
    supabase,
    id,
    { user_id: user.id },
    { context_document_id: contextDocumentId },
  );

  if (!result.ok) {
    notFound();
  }

  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href={"/documents" as Route}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            ← 문서 목록
          </Link>
          {contextDocumentId ? (
            <Link
              href={`/documents/${contextDocumentId}` as Route}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              ← 이전 문서 상세
            </Link>
          ) : null}
        </div>

        <ComparisonHistoryDetailView data={result.data} contextDocumentId={contextDocumentId} />
      </section>
    </div>
  );
}
