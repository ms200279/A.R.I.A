"use client";

import { useState } from "react";

import { tryParseAnalysisResult } from "@/lib/documents/parse-stored-document-results";
import type { DocumentDetailLatestBlock } from "@/types/document-ui";

import DocumentEmptyState from "./DocumentEmptyState";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function BulletList({ items, accent }: { items: string[]; accent: "default" | "warning" }) {
  if (!items.length) return null;
  const dotBg = accent === "warning" ? "bg-[var(--warning)]" : "bg-[var(--accent)]";
  return (
    <ul className="mt-2 list-none space-y-1.5 text-sm text-[var(--text-secondary)]">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotBg}`} />
          <span className="leading-relaxed">{t}</span>
        </li>
      ))}
    </ul>
  );
}

type Props = {
  latest: DocumentDetailLatestBlock | null;
};

const COLLAPSE_LINES = "line-clamp-6";

/**
 * 해석·리스크·후속 질문을 강조해 요약 카드와 시각적으로 구분. assistant 인라인 카드로 내용 구조 재사용 가능.
 */
export default function DocumentAnalysisCard({ latest }: Props) {
  const [expanded, setExpanded] = useState(false);
  const parsed = latest?.content ? tryParseAnalysisResult(latest.content) : null;

  if (!latest?.content?.trim()) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-medium text-[var(--text-primary)]">분석</h2>
        <DocumentEmptyState
          title="아직 분석 결과가 없습니다"
          description="문서가 준비되면 아래에서 분석을 실행할 수 있습니다. 요약보다 한 단계 해석적인 결과가 표시됩니다."
        />
      </section>
    );
  }

  const analysisText = parsed?.analysis ?? latest.content;
  const long = analysisText.length > 900 || analysisText.split("\n").length > 8;

  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium text-[var(--text-primary)]">분석</h2>
      <article className="rounded-[var(--radius-lg)] border border-[var(--accent-soft)] bg-[var(--bg-elevated)]/50 p-4 shadow-sm shadow-black/15">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-strong)]">
            {latest.summary_type}
          </span>
          <time dateTime={latest.created_at}>{formatWhen(latest.created_at)}</time>
        </div>

        <div
          className={`text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words ${
            long && !expanded ? COLLAPSE_LINES : ""
          }`}
        >
          {analysisText}
        </div>

        {long ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            {expanded ? "접기" : "더 보기"}
          </button>
        ) : null}

        {parsed?.key_points?.length ? (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              핵심 포인트
            </h3>
            <BulletList items={parsed.key_points} accent="default" />
          </div>
        ) : null}

        {parsed?.potential_risks?.length ? (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              잠재 리스크
            </h3>
            <BulletList items={parsed.potential_risks} accent="warning" />
          </div>
        ) : null}

        {parsed?.follow_up_questions?.length ? (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              추가로 확인할 질문
            </h3>
            <BulletList items={parsed.follow_up_questions} accent="default" />
          </div>
        ) : null}
      </article>
    </section>
  );
}
