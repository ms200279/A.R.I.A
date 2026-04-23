import { redirect } from "next/navigation";

import DashboardShell from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";

/**
 * (dashboard) 는 로그인이 필요한 영역이다.
 * middleware 에서도 보호되지만 서버 컴포넌트 측에서 2차 체크 (defense in depth).
 * 실제 시각 레이아웃(사이드바 + 메인)은 client 컴포넌트인 DashboardShell 이 담당한다.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell userEmail={user.email ?? null}>{children}</DashboardShell>
  );
}
