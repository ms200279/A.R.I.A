"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DocumentListItemPayload } from "@/types/document";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isListResponse(body: unknown): body is {
  items: DocumentListItemPayload[];
  next_cursor: string | null;
  sort: string;
} {
  if (!isRecord(body) || !Array.isArray(body.items)) return false;
  return true;
}

type Props = {
  initialItems: DocumentListItemPayload[];
  initialNextCursor: string | null;
  sort: "created_at" | "updated_at";
};

export default function DocumentsListSection({
  initialItems,
  initialNextCursor,
  sort,
}: Props) {
  const [extraItems, setExtraItems] = useState<DocumentListItemPayload[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const baselineKey = initialItems.map((i) => i.id).join("|");
  const prevBaseline = useRef<string | null>(null);

  useEffect(() => {
    if (prevBaseline.current === baselineKey) return;
    prevBaseline.current = baselineKey;
    setExtraItems([]);
    setNextCursor(initialNextCursor);
    setLoadError(null);
  }, [baselineKey, initialNextCursor]);

  const merged = [...initialItems, ...extraItems];
  const seen = new Set<string>();
  const items = merged.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const p = new URLSearchParams();
      p.set("cursor", nextCursor);
      p.set("sort", sort);
      p.set("limit", "30");
      const res = await fetch(`/api/documents?${p.toString()}`, { credentials: "same-origin" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !isListResponse(body)) {
        setLoadError("목록을 더 불러오지 못했습니다.");
        return;
      }
      setExtraItems((prev) => [...prev, ...body.items]);
      setNextCursor(body.next_cursor);
    } catch {
      setLoadError("네트워크 오류로 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, sort]);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-sm text-[var(--text-tertiary)]">
        아직 문서가 없습니다. 위에서 파일을 올리면 목록에 나타납니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
                    {doc.status}
                  </span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
                    파싱 {doc.parsing_status ?? "—"}
                  </span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[var(--text-secondary)]">
                    전처리 {doc.preprocessing_status ?? "—"}
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

      {nextCursor ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-[var(--radius-md)] border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-[var(--text-secondary)] hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "불러오는 중…" : "더 보기"}
          </button>
          {loadError ? (
            <p className="text-xs text-red-300/90" role="alert">
              {loadError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
