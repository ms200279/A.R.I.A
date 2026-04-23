"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/browser";

/**
 * Supabase Auth 기준의 로그인 골격.
 * - 이번 단계에서는 매직링크(이메일 OTP) 한 가지 경로만 제공한다.
 * - Google OAuth 등은 후속 단계에서 공급자 버튼을 추가한다.
 * - 실제 UX 는 최소한이며, 승인/초안 관련 UI 패턴과 섞지 않는다.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const supabase = createClient();
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
      setStatus("sent");
      setMessage("메일로 보낸 로그인 링크를 확인하세요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "알 수 없는 오류");
    }
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
