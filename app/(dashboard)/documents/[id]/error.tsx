"use client";

import Link from "next/link";
import type { Route } from "next";

export default function DocumentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-lg font-medium text-[var(--text-primary)]">문서를 불러오지 못했습니다</p>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        {error.message || "일시적인 오류일 수 있습니다. 다시 시도하거나 목록으로 돌아가 주세요."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent-strong)]"
        >
          다시 시도
        </button>
        <Link
          href={"/documents" as Route}
          className="rounded-[var(--radius-md)] border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-secondary)]"
        >
          문서 목록
        </Link>
      </div>
    </div>
  );
}
