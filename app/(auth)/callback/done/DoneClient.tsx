"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { notifyAuthCompleted } from "@/lib/auth/cross-tab";

/**
 * 콜백 성공 후 처리:
 *   1. 원래 탭에 "인증 완료" 신호를 보낸다 (BroadcastChannel + storage).
 *   2. 본 탭을 닫으려 시도한다. 사용자가 직접 연 탭은 대부분 window.close() 가 무시된다.
 *   3. 일정 시간 후에도 닫히지 않은 경우를 가정하고 안내 문구를 표시한다.
 *
 * 이 페이지는 실제 세션 교환을 수행하지 않는다. 교환은 `/callback` 서버 라우트에서 이미 끝났다.
 * 여기서는 "원래 탭"으로의 복귀 UX 만 담당한다.
 */
export default function DoneClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    notifyAuthCompleted(next);

    const closeTimer = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // 일부 브라우저는 스크립트로 연 창이 아니면 close() 를 무시한다. fallback 문구로 대체.
      }
    }, 100);

    // window.close() 성공/실패를 탐지할 표준 API 가 없으므로, 일정 지연 후에는
    // 항상 fallback 안내를 노출한다. 닫히면 이 코드도 함께 사라진다.
    const fallbackTimer = window.setTimeout(() => setShowFallback(true), 700);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [next]);

  function onManualClose() {
    try {
      window.close();
    } catch {
      // 무시.
    }
  }

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">로그인 완료</h1>
      <p className="text-sm opacity-75">
        {showFallback
          ? "이 창을 닫고 원래 창으로 돌아가세요. 원래 창이 자동으로 다음 단계로 이동합니다."
          : "잠시만 기다려 주세요. 이 창은 곧 닫힙니다."}
      </p>
      {showFallback ? (
        <button
          type="button"
          onClick={onManualClose}
          className="inline-flex items-center rounded border border-black/15 px-3 py-1.5 text-xs font-medium dark:border-white/15"
        >
          창 닫기
        </button>
      ) : null}
    </section>
  );
}
