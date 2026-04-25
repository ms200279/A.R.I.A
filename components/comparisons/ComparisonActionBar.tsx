"use client";

import { useId } from "react";
import Link from "next/link";
import type { Route } from "next";

import ComparisonBookmarkButton from "./ComparisonBookmarkButton";
import ComparisonCopyLinkButton from "./ComparisonCopyLinkButton";

type Props = {
  comparisonId: string;
  /**
   * URL `from` — 링크 복사·딥링크 맥락 유지. 없으면 쿼리 생략.
   */
  fromDocumentId: string | null;
  /**
   * 링크「문서로 이동」대상( 맥락 우선, 없으면 primary ).
   */
  primaryDocumentId: string;
  initialIsBookmarked: boolean;
};

/**
 * 내부 딥링크·북마크·문서 이동만( 외부 공개 / export 없음 ).
 * 문서 카드·assistant 인라인에서도 동일 props 로 재사용 가능.
 */
export default function ComparisonActionBar({
  comparisonId,
  fromDocumentId,
  primaryDocumentId,
  initialIsBookmarked,
}: Props) {
  const rootId = useId();
  const scopeHintId = `${rootId}-internal-scope-hint`;
  const documentHref = `/documents/${fromDocumentId ?? primaryDocumentId}` as Route;
  const documentLabel = fromDocumentId ? "맥락 문서로" : "기준 문서로";

  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/80 p-3"
      role="region"
      aria-label="비교 참조"
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <ComparisonCopyLinkButton
          comparisonId={comparisonId}
          fromDocumentId={fromDocumentId}
          descriptionId={scopeHintId}
        />
        <ComparisonBookmarkButton
          comparisonId={comparisonId}
          initialIsBookmarked={initialIsBookmarked}
        />
        <Link
          href={documentHref}
          className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-white/[0.04] px-3 py-1.5 text-sm text-[var(--accent)] hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)]"
        >
          {documentLabel} 이동
        </Link>
      </div>
      <p id={scopeHintId} className="mt-2 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        복사한 링크는 이 앱에 로그인한 본인만 열 수 있으며, 자동으로 외부에 공개되지 않습니다. 공개
        공유·다운로드는 제공하지 않습니다.
      </p>
    </div>
  );
}
