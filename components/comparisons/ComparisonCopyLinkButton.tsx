"use client";

import { useCallback } from "react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { getComparisonDetailAbsoluteUrl } from "@/lib/comparisons/comparison-deep-link";

type Props = {
  comparisonId: string;
  fromDocumentId: string | null;
  /** 내부 링크 범위 설명( 부모 `p` id ) */
  descriptionId?: string;
};

/**
 * 절대 URL 복사( 동일 origin ). 열람 권한은 서버·세션.
 */
export default function ComparisonCopyLinkButton({
  comparisonId,
  fromDocumentId,
  descriptionId,
}: Props) {
  const { state, copy, reset } = useCopyToClipboard();

  const onClick = useCallback(async () => {
    if (typeof window === "undefined") return;
    reset();
    const url = getComparisonDetailAbsoluteUrl(
      window.location.origin,
      comparisonId,
      fromDocumentId,
    );
    await copy(url);
  }, [comparisonId, copy, fromDocumentId, reset]);

  const showCopied = state === "copied";
  const showErr = state === "error";

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => void onClick()}
        className="rounded-[var(--radius-md)] border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)]"
        title="클립보드에 이 페이지의 앱 내부 URL을 넣습니다"
        aria-label="내부 딥링크 복사"
        aria-describedby={descriptionId}
      >
        {showCopied ? "복사됨" : showErr ? "다시 복사" : "링크 복사"}
      </button>
      {showErr ? (
        <span className="max-w-[14rem] text-xs text-amber-200/90" role="status">
          클립보드를 사용할 수 없습니다.
        </span>
      ) : null}
    </div>
  );
}
