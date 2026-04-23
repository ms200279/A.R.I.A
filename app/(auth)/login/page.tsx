"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { subscribeAuthCompleted } from "@/lib/auth/cross-tab";
import { createClient } from "@/lib/supabase/browser";

/**
 * Supabase Auth 기준의 로그인 골격.
 * - 이번 단계에서는 매직링크(이메일 OTP) 한 가지 경로만 제공한다.
 * - Google OAuth 등은 후속 단계에서 공급자 버튼을 추가한다.
 * - 실제 UX 는 최소한이며, 승인/초안 관련 UI 패턴과 섞지 않는다.
 *
 * 상태 모델:
 *   idle       — 초기/대기
 *   sending    — OTP 발송 요청 중
 *   pending    — 메일 발송 완료. 사용자가 링크 클릭하기를 기다리는 상태.
 *                BroadcastChannel + storage + 세션 폴링 3단 구조로 인증 완료를 감지.
 *   completed  — 인증 완료 감지됨. 즉시 라우팅되지만 짧게 확인 문구를 노출해
 *                사용자에게 "자동 이동이 일어났다"는 피드백을 준다.
 *   error      — OTP 요청 단계에서 실패. 메시지는 공급자 메시지를 그대로 노출.
 */
type Status = "idle" | "sending" | "pending" | "completed" | "error";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const redirectedRef = useRef(false);

  const goNext = useCallback(
    (next: string) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      const target = (next && next.startsWith("/") ? next : "/") as Route;
      setStatus("completed");
      // 렌더 프레임을 한 번 양보해 완료 UI 가 사용자에게 보이도록 한 뒤 이동.
      window.setTimeout(() => router.replace(target), 0);
    },
    [router],
  );

  // 이미 로그인된 상태로 /login 에 진입한 경우 즉시 이동.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) {
        goNext("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, goNext]);

  // "pending" 상태에서만 감지 루프를 돌린다.
  useEffect(() => {
    if (status !== "pending") return;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) goNext("/");
      } catch {
        // 네트워크 순간 단절 등은 무시하고 다음 틱에 재시도.
      }
    };

    const intervalId = window.setInterval(checkSession, 4000);
    const onFocus = () => {
      void checkSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const unsubscribe = subscribeAuthCompleted((payload) => {
      goNext(payload.next ?? "/");
    });

    void checkSession();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
  }, [status, supabase, goNext]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/callback`,
        },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("pending");
      setMessage("로그인 링크를 이메일로 보냈습니다. 이 창은 닫지 마세요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "알 수 없는 오류");
    }
  }

  function onUseDifferentEmail() {
    redirectedRef.current = false;
    setStatus("idle");
    setMessage(null);
  }

  if (status === "completed") {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">로그인 확인됨</h1>
        <p className="text-sm opacity-75">대시보드로 이동하는 중입니다...</p>
      </section>
    );
  }

  if (status === "pending") {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">메일을 확인해 주세요</h1>
          <p className="text-sm opacity-75">
            {email ? `${email} 로 ` : ""}
            로그인 링크를 보냈습니다. 메일의 링크를 클릭하면 이 창이 자동으로 다음 화면으로 이동합니다.
          </p>
        </header>

        <div className="rounded border border-black/10 p-3 text-xs opacity-75 dark:border-white/15">
          <p className="font-medium">이 창을 닫지 마세요.</p>
          <p className="mt-1">
            링크는 다른 탭/창에서 열려도 괜찮습니다. 인증이 끝나면 이 창이 자동으로 감지해 이동합니다.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-current opacity-60" aria-hidden />
          <span className="opacity-75">인증 완료 대기 중...</span>
        </div>

        <button
          type="button"
          onClick={onUseDifferentEmail}
          className="text-xs underline opacity-75 hover:opacity-100"
        >
          다른 이메일로 다시 시도
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">aria 로그인</h1>
        <p className="text-sm opacity-75">이메일로 일회용 로그인 링크를 받습니다.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">이메일</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/50 dark:border-white/15 dark:focus:border-white/50"
            placeholder="you@example.com"
          />
        </label>

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}
        >
          {status === "sending" ? "전송 중..." : "로그인 링크 받기"}
        </button>

        {message ? (
          <p className={status === "error" ? "text-sm text-red-600" : "text-sm opacity-75"}>
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
