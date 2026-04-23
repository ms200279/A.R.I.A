"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { requestServerSignOut } from "@/lib/auth/sign-out";

/**
 * 대시보드 헤더에서 노출되는 로그아웃 버튼.
 *
 * 흐름:
 *   1. `POST /api/auth/logout` 으로 서버 세션(쿠키) 을 정리한다.
 *   2. 성공 시 `router.replace("/login")` + `router.refresh()` 로 RSC 캐시까지 날리고 이동한다.
 *   3. 실패 시 사유 문자열을 짧게 노출하고 버튼을 다시 활성화한다. 사용자가 재시도 가능.
 *
 * 구현 메모:
 * - useTransition 으로 router navigation 중 상태를 표현한다. fetch 와 transition 이 각각
 *   `loading` / `isPending` 으로 분리되어 UX 가 더 또렷하다.
 * - 경로는 `typedRoutes` 대응을 위해 `as Route` 캐스팅.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    const result = await requestServerSignOut();
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "logout_failed");
      return;
    }

    startTransition(() => {
      router.replace("/login" as Route);
      router.refresh();
    });
  }

  const busy = loading || isPending;

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-60 dark:border-white/15"
      >
        {busy ? "로그아웃 중..." : "로그아웃"}
      </button>
    </div>
  );
}
