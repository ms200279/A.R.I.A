"use client";

import { useId } from "react";

import { useComparisonBookmark } from "@/hooks/useComparisonBookmark";

type Props = {
  comparisonId: string;
  initialIsBookmarked: boolean;
};

/**
 * idempotent add 는 API( unique 위반 → 성공 ) 가 처리.
 */
export default function ComparisonBookmarkButton({
  comparisonId,
  initialIsBookmarked,
}: Props) {
  const { saved, working, status, toggle } = useComparisonBookmark(
    comparisonId,
    initialIsBookmarked,
  );
  const id = useId();
  const errId = `${id}-bm-err`;
  const okId = `${id}-bm-ok`;

  return (
    <div className="flex min-w-0 max-w-sm flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={working}
        className="rounded-[var(--radius-md)] border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-pressed={saved}
        aria-describedby={
          status.kind === "error" ? errId : status.kind === "ok" ? okId : undefined
        }
        title={saved ? "저장됨 — 클릭하면 해제" : "이 비교를 저장해 다시 찾기 쉽게"}
      >
        {working ? "…" : saved ? "저장됨" : "저장"}
      </button>
      {status.kind === "error" ? (
        <p id={errId} className="text-xs text-amber-200/90" role="alert">
          {status.message}
        </p>
      ) : null}
      {status.kind === "ok" ? (
        <p id={okId} className="text-xs text-emerald-200/90" role="status">
          {status.saved ? "북마크에 저장했습니다." : "북마크를 해제했습니다."}
        </p>
      ) : null}
    </div>
  );
}
