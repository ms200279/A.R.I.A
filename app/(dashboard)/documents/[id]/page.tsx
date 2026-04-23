import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import DocumentAnalysisCard from "@/components/documents/DocumentAnalysisCard";
import DocumentComparisonCard from "@/components/documents/DocumentComparisonCard";
import DocumentDetailActions from "@/components/documents/DocumentDetailActions";
import DocumentMetaPanel from "@/components/documents/DocumentMetaPanel";
import DocumentSummaryCard from "@/components/documents/DocumentSummaryCard";
import { getDocumentDetail } from "@/lib/documents/get-document";
import { createClient } from "@/lib/supabase/server";
import type { DocumentMetaPanelModel } from "@/types/document-ui";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    notFound();
  }

  const result = await getDocumentDetail(supabase, id, {
    user_id: user.id,
    user_email: user.email ?? null,
    source: "rsc",
  });

  if (!result.ok) {
    notFound();
  }

  const d = result.document;

  const meta: DocumentMetaPanelModel = {
    title: d.title,
    file_name: d.file_name,
    file_type: d.file_type,
    file_size: d.file_size,
    source: d.source,
    parsing_status: d.parsing_status,
    preprocessing_status: d.preprocessing_status,
    summary_status: d.summary_status,
    created_at: d.created_at,
    updated_at: d.updated_at,
    can_compare: d.can_compare,
    can_summarize: d.can_summarize,
    chunk_count: d.chunk_count,
  };

  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href={"/documents" as Route}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            ← 문서 목록
          </Link>
        </div>

        <DocumentMetaPanel meta={meta} />

        <DocumentDetailActions
          documentId={d.id}
          canSummarize={d.can_summarize}
          canCompare={d.can_compare}
        />

        <DocumentSummaryCard latest={d.latest_summary} />

        <DocumentComparisonCard latest={d.latest_comparison} />

        <DocumentAnalysisCard latest={d.latest_analysis} />
      </section>
    </div>
  );
}
