import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * (dashboard) 는 로그인이 필요한 영역이다.
 * middleware 에서도 보호되지만 서버 컴포넌트 측에서 2차 체크 (defense in depth).
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
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-semibold">aria</h1>
        <span className="text-xs opacity-60">{user.email}</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
