import Link from "next/link";
import type { Route } from "next";

/**
 * 대시보드 홈 (URL: `/`).
 * 이번 P0 단계에서는 자리만 잡아 둔다. 후속 단계에서:
 * - 채팅 입구, 문서/메모/캘린더 섹션 링크
 * - 승인 대기(`pending_actions`) 카드 리스트
 * - 오늘 요약 등을 채운다.
 */
export default function DashboardHome() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">무엇을 도와드릴까요?</h2>
        <p className="text-sm opacity-75">
          문서 요약, 메일 요약, 일정 정리, 메모 저장 등을 도와드립니다. 실행이 필요한 일은 항상 승인
          후에 진행합니다.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded border border-black/10 p-4 text-sm dark:border-white/10">
          <Link
            href={"/memos" as Route}
            className="font-medium underline-offset-2 hover:underline"
          >
            메모
          </Link>{" "}
          — 명시 저장 · 승인 후 기록 · 검색/요약
        </li>
        {["문서", "메일", "캘린더"].map((label) => (
          <li
            key={label}
            className="rounded border border-black/10 p-4 text-sm opacity-60 dark:border-white/10"
          >
            {label} — 구현 예정
          </li>
        ))}
      </ul>
    </section>
  );
}
