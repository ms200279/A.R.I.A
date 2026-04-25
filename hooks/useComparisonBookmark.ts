"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BookmarkStatus = { kind: "idle" } | { kind: "ok"; saved: boolean } | { kind: "error"; message: string };

/**
 * `POST/DELETE /api/comparisons/[id]/bookmark` — 본인 소유 비교만( 서버·RLS ).
 * 성공 메시지는 잠시 후 자동으로 사라짐.
 */
export function useComparisonBookmark(comparisonId: string, initialSaved: boolean) {
  const [saved, setSaved] = useState(initialSaved);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<BookmarkStatus>({ kind: "idle" });
  const inFlight = useRef(false);

  useEffect(() => {
    if (status.kind === "ok") {
      const t = setTimeout(() => setStatus({ kind: "idle" }), 2800);
      return () => clearTimeout(t);
    }
    return;
  }, [status]);

  const toggle = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setStatus({ kind: "idle" });
    try {
      const method = saved ? "DELETE" : "POST";
      const res = await fetch(`/api/comparisons/${comparisonId}/bookmark`, {
        method,
        credentials: "same-origin",
      });
      if (res.status === 401) {
        setStatus({ kind: "error", message: "로그인이 필요합니다." });
        return;
      }
      if (res.status === 404) {
        setStatus({ kind: "error", message: "이 비교를 찾을 수 없습니다." });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: "북마크를 저장하지 못했습니다." });
        return;
      }
      const next = !saved;
      setSaved(next);
      setStatus({ kind: "ok", saved: next });
    } catch {
      setStatus({ kind: "error", message: "네트워크 오류입니다." });
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }, [comparisonId, saved]);

  return { saved, working, status, toggle };
}
