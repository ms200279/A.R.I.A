"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

export default function SearchBox({
  initialQuery = "",
  initialProjectKey = "",
}: {
  initialQuery?: string;
  initialProjectKey?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [project, setProject] = useState(initialProjectKey);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    const tag = project.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    const href = (qs ? `/memos?${qs}` : "/memos") as Route;
    router.push(href);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="제목 · 본문 · 요약 · 프로젝트 키 검색"
        className="w-full min-w-0 rounded border border-black/15 bg-transparent px-2 py-1 text-xs sm:w-56 dark:border-white/15"
        autoComplete="off"
      />
      <input
        type="text"
        value={project}
        onChange={(e) => setProject(e.target.value)}
        placeholder="프로젝트(정확히 일치)"
        className="w-full min-w-0 rounded border border-black/15 bg-transparent px-2 py-1 text-xs sm:w-40 dark:border-white/15"
        autoComplete="off"
      />
      <button
        type="submit"
        className="shrink-0 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/15"
      >
        적용
      </button>
    </form>
  );
}
