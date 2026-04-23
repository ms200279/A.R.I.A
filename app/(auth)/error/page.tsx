import Link from "next/link";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

/**
 * 인증 실패 시 표시되는 최소 에러 페이지.
 * - 상세 원인은 사용자에게 노출하지 않고 대략적 분류만 보여준다.
 * - 서버 측 상세 에러는 감사 로그(`lib/logging`) 에 기록하는 것을 지향한다. (후속)
 */
export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">로그인 오류</h1>
      <p className="text-sm opacity-75">
        인증 처리 중 문제가 발생했습니다.
        {reason ? ` (${reason})` : null}
      </p>
      <Link href="/login" className="inline-block text-sm underline">
        로그인으로 돌아가기
      </Link>
    </section>
  );
}
