import Link from "next/link";
import type { Route } from "next";

import { listDocuments } from "@/lib/documents/list-documents";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  const { items, next_cursor, sort } = await listDocuments(supabase, {
    scope_user_id: user.id,
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
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-sm text-[var(--text-tertiary)]">
            아직 문서가 없습니다. API{" "}
            <code className="rounded bg-white/10 px-1">POST /api/documents/upload</code>로 파일을
            올리면 여기에 나타납니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}` as Route}
                  className="block rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--text-primary)]">
                        {doc.title?.trim() || doc.file_name || "제목 없음"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
                        {doc.file_name ?? "—"} · {doc.file_type ?? "타입 미상"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
                        파싱 {doc.parsing_status ?? "—"}
                      </span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
                        요약 {doc.summary_status ?? "—"}
                      </span>
                      {doc.latest_summary_exists ? (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200/90">
                          요약 있음
                        </span>
                      ) : (
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[var(--text-tertiary)]">
                          요약 없음
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.latest_summary_preview ? (
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {doc.latest_summary_preview}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {next_cursor ? (
          <p className="text-xs text-[var(--text-tertiary)]">
            다음 페이지:{" "}
            <code className="rounded bg-white/10 px-1">
              GET /api/documents?cursor=
              {encodeURIComponent(next_cursor)}
            </code>
          </p>
        ) : null}
      </section>
    </div>
  );
}
