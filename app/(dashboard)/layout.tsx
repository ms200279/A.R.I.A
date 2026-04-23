import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import LogoutButton from "./_components/logout-button";

/**
 * (dashboard) 는 로그인이 필요한 영역이다.
 * middleware 에서도 보호되지만 서버 컴포넌트 측에서 2차 체크 (defense in depth).
 * 헤더에 현재 사용자 이메일과 로그아웃 버튼을 고정으로 노출한다.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">aria</h1>
        <div className="flex items-center gap-3">
          <span
            className="max-w-[200px] truncate text-xs opacity-60"
            title={user.email ?? undefined}
          >
            {user.email ?? "(알 수 없는 사용자)"}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
