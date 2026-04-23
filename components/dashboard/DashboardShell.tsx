"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import AppSidebar from "./AppSidebar";

const SIDEBAR_COLLAPSED_KEY = "aria-dashboard-sidebar-collapsed";

type Props = {
  userEmail: string | null;
  children: React.ReactNode;
};

/**
 * 전체 대시보드 shell.
 *
 * 데스크톱 (>=1024px):
 *   기본 260px 고정 사이드바. 헤더의 「접기」로 숨기고, 메인 상단의 버튼으로 다시 연다.
 *   접힘 상태는 localStorage 에 저장한다.
 *
 * 모바일 (<1024px):
 *   상단 바의 햄버거로 drawer. 배경 탭·닫기 버튼·로고 링크 이동 시 닫힌다.
 */
export default function DashboardShell({ userEmail, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") {
        startTransition(() => setDesktopCollapsed(true));
      }
    } catch {
      /* ignore */
    }
    startTransition(() => setSidebarHydrated(true));
  }, []);

  useEffect(() => {
    if (!sidebarHydrated) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, desktopCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [desktopCollapsed, sidebarHydrated]);

  useEffect(() => {
    startTransition(() => setMobileOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div
        className={
          desktopCollapsed
            ? "lg:grid lg:h-dvh lg:grid-cols-1"
            : "lg:grid lg:h-dvh lg:grid-cols-[260px_1fr]"
        }
      >
        {/* 데스크톱 고정 사이드바 */}
        <div
          className={`hidden h-dvh lg:block ${desktopCollapsed ? "lg:hidden" : ""}`}
        >
          <AppSidebar
            userEmail={userEmail}
            variant="static"
            onCollapseDesktop={() => setDesktopCollapsed(true)}
          />
        </div>

        {/* 모바일 상단 바 */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="메뉴 열기"
            aria-expanded={mobileOpen}
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
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.18em] text-[var(--text-primary)] outline-none ring-[var(--accent)] focus-visible:rounded-sm focus-visible:ring-2"
          >
            A.R.I.A
          </Link>
          <div className="w-7" />
        </div>

        {/* 모바일 drawer */}
        {mobileOpen ? (
          <>
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <div
              id="app-sidebar-drawer"
              className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] lg:hidden"
              onClickCapture={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("a")) setMobileOpen(false);
              }}
            >
              <AppSidebar
                userEmail={userEmail}
                variant="drawer"
                onCloseDrawer={() => setMobileOpen(false)}
              />
            </div>
          </>
        ) : null}

        {/* 메인 영역 */}
        <main className="flex h-[calc(100dvh-49px)] min-h-0 flex-col lg:h-dvh">
          {desktopCollapsed ? (
            <div className="hidden shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2.5 lg:flex">
              <button
                type="button"
                onClick={() => setDesktopCollapsed(false)}
                className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                aria-label="메뉴 열기"
                aria-expanded={false}
                aria-controls="app-sidebar-desktop"
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
              <Link
                href="/"
                className="text-sm font-semibold tracking-[0.18em] text-[var(--text-primary)] outline-none ring-[var(--accent)] focus-visible:rounded-sm focus-visible:ring-2"
              >
                A.R.I.A
              </Link>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
