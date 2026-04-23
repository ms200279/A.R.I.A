import Link from "next/link";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

/**
 * 인증 실패 시 표시되는 최소 에러 페이지.
 * - 상세 원인(공급자 에러 메시지 등)은 사용자에게 노출하지 않고, 분류된 라벨만 보여준다.
 * - 라벨에 없는 reason 은 일반 안내 + 원본 코드를 괄호로 표기해 디버깅 단서는 남긴다.
 * - 서버 측 상세 에러는 감사 로그(`lib/logging`) 에 기록하는 것을 지향한다. (후속)
 */

const REASON_LABELS: Record<string, string> = {
  missing_code: "로그인 링크에 필요한 정보가 포함되어 있지 않습니다.",
  exchange_failed: "로그인 링크가 만료되었거나 이미 사용되었습니다.",
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const label = reason && REASON_LABELS[reason] ? REASON_LABELS[reason] : null;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">로그인 오류</h1>
      {label ? (
        <p className="text-sm opacity-75">{label}</p>
      ) : (
        <p className="text-sm opacity-75">
          인증 처리 중 문제가 발생했습니다.
          {reason ? ` (${reason})` : null}
        </p>
      )}
      <p className="text-xs opacity-60">로그인 페이지로 돌아가 다시 시도해 주세요.</p>
      <Link href="/login" className="inline-block text-sm underline">
        로그인으로 돌아가기
      </Link>
    </section>
  );
}
