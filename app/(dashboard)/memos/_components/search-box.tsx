"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

export default function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    const href = (trimmed ? `/memos?q=${encodeURIComponent(trimmed)}` : "/memos") as Route;
    router.push(href);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="제목 · 본문 · 프로젝트 키로 검색"
        className="w-56 rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
      />
      <button
        type="submit"
        className="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/15"
      >
        검색
      </button>
    </form>
  );
}
