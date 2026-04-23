"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

type Props = {
  href: Route | string;
  label: string;
  /** 아직 구현되지 않은 섹션은 disabled 로 표시. 클릭은 가능하되 톤을 낮춘다. */
  disabled?: boolean;
  icon?: React.ReactNode;
  /** 루트(`/`) 처럼 정확히 일치할 때만 active 로 볼지 여부. */
  exact?: boolean;
};

/**
 * 사이드바 단일 네비게이션 항목.
 * active 상태는 pathname 기반으로 계산한다.
 */
export default function SidebarLink({
  href,
  label,
  disabled = false,
  icon,
  exact = false,
}: Props) {
  const pathname = usePathname() ?? "/";
  const hrefStr = href.toString();
  const active = exact
    ? pathname === hrefStr
    : pathname === hrefStr || pathname.startsWith(`${hrefStr}/`);

  const base =
    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition";
  const tone = active
    ? "bg-white/[0.06] text-[var(--text-primary)]"
    : disabled
      ? "text-[var(--text-tertiary)] hover:bg-white/[0.03]"
      : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]";

  return (
    <Link href={href as Route} className={`${base} ${tone}`} aria-current={active ? "page" : undefined}>
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          active
            ? "border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
            : "border-white/10 bg-white/[0.02] text-[var(--text-tertiary)] group-hover:border-white/20 group-hover:text-[var(--text-secondary)]"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {disabled ? (
        <span className="rounded-full border border-white/10 px-2 py-[1px] text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
          soon
        </span>
      ) : null}
    </Link>
  );
}
