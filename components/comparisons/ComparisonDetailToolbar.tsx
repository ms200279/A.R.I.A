"use client";

import { useCallback, useMemo, useState } from "react";

type Props = {
  comparisonId: string;
  /** `from` 쿼리(문서 맥락) — 딥링크에 그대로 포함 */
  fromDocumentId: string | null;
  initialIsBookmarked: boolean;
};

/**
 * 내부 딥링크 복사(로그인 앱에서만) + 내부 북마크. 외부 공개/토큰 링크 없음.
 */
export default function ComparisonDetailToolbar({
  comparisonId,
  fromDocumentId,
  initialIsBookmarked,
}: Props) {
  const [bookmarked, setBookmarked] = useState(initialIsBookmarked);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const internalPath = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDocumentId) p.set("from", fromDocumentId);
    const q = p.toString();
    return q ? `/comparisons/${comparisonId}?${q}` : `/comparisons/${comparisonId}`;
  }, [comparisonId, fromDocumentId]);

  const copyLink = useCallback(async () => {
    setMsg(null);
    setErr(null);
    try {
      const origin = window.location.origin;
      await navigator.clipboard.writeText(`${origin}${internalPath}`);
      setMsg("내부 링크를 복사했습니다. 로그인한 계정에서만 열 수 있습니다.");
    } catch {
      setErr("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }, [internalPath]);

  const toggleBookmark = useCallback(async () => {
    if (working) return;
    setWorking(true);
    setMsg(null);
    setErr(null);
    try {
      const method = bookmarked ? "DELETE" : "POST";
      const res = await fetch(`/api/comparisons/${comparisonId}/bookmark`, {
        method,
        credentials: "same-origin",
      });
      if (res.status === 401) {
        setErr("로그인이 필요합니다.");
        return;
      }
      if (res.status === 404) {
        setErr("이 비교를 찾을 수 없습니다.");
        return;
      }
      if (!res.ok) {
        setErr("북마크를 저장하지 못했습니다.");
        return;
      }
      const next = !bookmarked;
      setBookmarked(next);
      setMsg(next ? "북마크에 추가했습니다." : "북마크를 해제했습니다.");
    } catch {
      setErr("네트워크 오류입니다.");
    } finally {
      setWorking(false);
    }
  }, [bookmarked, comparisonId, working]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-[var(--radius-md)] border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)]"
        >
          내부 링크 복사
        </button>
        <button
          type="button"
          onClick={() => void toggleBookmark()}
          disabled={working}
          className="rounded-[var(--radius-md)] border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)] disabled:opacity-50"
          aria-pressed={bookmarked}
        >
          {bookmarked ? "북마크 해제" : "북마크"}
        </button>
      </div>
      {msg ? <p className="text-xs text-emerald-200/90">{msg}</p> : null}
      {err ? (
        <p className="text-xs text-amber-200/90" role="alert">
          {err}
        </p>
      ) : null}
      <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        링크는 이 앱에 로그인한 본인만 열 수 있습니다. 외부에 자동으로 공개되지 않습니다.
      </p>
    </div>
  );
}
