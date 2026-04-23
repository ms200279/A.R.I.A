"use client";

import { useEffect, useState } from "react";

import AppSidebar from "./AppSidebar";

type Props = {
  userEmail: string | null;
  children: React.ReactNode;
};

/**
 * 전체 대시보드 shell.
 *
 * 데스크톱 (>=1024px):
 *   grid-cols-[260px_1fr] 고정. 사이드바는 항상 보인다.
 *
 * 모바일 (<1024px):
 *   사이드바는 overlay drawer 로 접힌다. 상단 작은 바에 햄버거 버튼.
 *   경로가 바뀌면 drawer 를 자동으로 닫아 이동감이 깔끔해진다.
 */
export default function DashboardShell({ userEmail, children }: Props) {
  const [open, setOpen] = useState(false);

  // drawer 열렸을 때 body 스크롤 잠금.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="lg:grid lg:h-dvh lg:grid-cols-[260px_1fr]">
        {/* 데스크톱 고정 사이드바 */}
        <div className="hidden lg:block lg:h-dvh">
          <AppSidebar userEmail={userEmail} />
        </div>

        {/* 모바일 상단 바 */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="메뉴 열기"
            aria-expanded={open}
            aria-controls="app-sidebar-drawer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm font-semibold tracking-[0.18em] text-[var(--text-primary)]">
            A.R.I.A
          </div>
          <div className="w-7" />
        </div>

        {/* 모바일 drawer */}
        {open ? (
          <>
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <div
              id="app-sidebar-drawer"
              className="aria-drawer-in fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] lg:hidden"
              onClickCapture={(e) => {
                // drawer 내부의 Link 클릭 시 drawer 를 닫아 자연스러운 네비게이션감을 만든다.
                const target = e.target as HTMLElement;
                if (target.closest("a")) setOpen(false);
              }}
            >
              <AppSidebar userEmail={userEmail} />
            </div>
          </>
        ) : null}

        {/* 메인 영역 */}
        <main className="h-[calc(100dvh-49px)] lg:h-dvh">
          {children}
        </main>
      </div>
    </div>
  );
}
