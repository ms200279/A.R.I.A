import LogoutButton from "@/app/(dashboard)/_components/logout-button";

import SidebarLink from "./SidebarLink";

type Props = {
  userEmail: string | null;
};

/**
 * 좌측 고정 사이드바.
 *
 * 구조:
 *   상단: 서비스 마크 (A.R.I.A)
 *   중앙: 섹션 메뉴
 *   하단: 사용자 이메일 + 로그아웃
 *
 * 현재 구현되어 있지 않은 섹션(Documents, Calendar, Mail, Approvals, Settings)은
 * `disabled` 플래그로 톤을 낮춰 노출한다. 사이드바 IA 를 유지하되,
 * 실제로 클릭하면 존재하지 않는 경로로 이동하는 일이 없도록 href 는 `/` 로 둔다.
 */
export default function AppSidebar({ userEmail }: Props) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-white/5 bg-[var(--bg-raised)]/80 backdrop-blur">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <LogoMark />
        <div className="leading-none">
          <div className="text-sm font-semibold tracking-[0.18em] text-[var(--text-primary)]">
            A.R.I.A
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            understanding assistant
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <SectionLabel>Workspace</SectionLabel>
        <SidebarLink
          href="/"
          exact
          label="Assistant"
          icon={<IconSphere />}
        />
        <SidebarLink
          href="/memos"
          label="Memos"
          icon={<IconNote />}
        />

        <SectionLabel className="mt-6">Connected (soon)</SectionLabel>
        <SidebarLink href="/" disabled label="Documents" icon={<IconDoc />} />
        <SidebarLink href="/" disabled label="Calendar" icon={<IconCal />} />
        <SidebarLink href="/" disabled label="Mail" icon={<IconMail />} />
        <SidebarLink
          href="/"
          disabled
          label="Approvals"
          icon={<IconCheck />}
        />

        <SectionLabel className="mt-6">System</SectionLabel>
        <SidebarLink href="/" disabled label="Settings" icon={<IconGear />} />
      </nav>

      <div className="border-t border-white/5 px-4 pb-5 pt-4">
        <div
          className="mb-3 truncate text-[11px] text-[var(--text-tertiary)]"
          title={userEmail ?? undefined}
        >
          {userEmail ?? "(알 수 없는 사용자)"}
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * 아이콘 (Lucide 스타일 inline SVG. 외부 라이브러리 없음)
 * ───────────────────────────────────────────────────────── */

function LogoMark() {
  return (
    <div
      aria-hidden
      className="relative h-8 w-8 rounded-lg border border-white/10 bg-gradient-to-br from-[color:var(--accent-soft)] to-white/[0.02]"
    >
      <div className="absolute inset-1 rounded-md bg-[radial-gradient(circle_at_30%_30%,rgba(199,212,255,0.8),rgba(155,180,255,0.15)_50%,transparent_70%)]" />
    </div>
  );
}

function svgProps() {
  return {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
}

function IconSphere() {
  return (
    <svg {...svgProps()}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c3 3.5 3 12.5 0 16" />
      <path d="M12 4c-3 3.5-3 12.5 0 16" />
    </svg>
  );
}
function IconNote() {
  return (
    <svg {...svgProps()}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 10h8" />
      <path d="M8 14h6" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg {...svgProps()}>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg {...svgProps()}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16" />
      <path d="M9 3v4M15 3v4" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg {...svgProps()}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...svgProps()}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg {...svgProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a7.9 7.9 0 0 0 .1-2 7.9 7.9 0 0 0-.1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-3.4-2L13 2h-2l-.6 2.9a8 8 0 0 0-3.4 2l-2.4-1-2 3.5L4.6 11a7.9 7.9 0 0 0-.1 2 7.9 7.9 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 3.4 2L11 22h2l.6-2.9a8 8 0 0 0 3.4-2l2.4 1 2-3.5z" />
    </svg>
  );
}
