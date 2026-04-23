"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status =
  | { kind: "idle" }
  | { kind: "pending"; sensitivity_flag: boolean }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; message: string };

const BLOCK_MESSAGES: Record<string, string> = {
  missing_explicit_intent: "명시 저장 의도가 확인되지 않아 차단되었습니다. '저장 요청' 체크를 켜 주세요.",
  empty_content: "본문이 비어 있습니다.",
  too_long: "본문이 너무 깁니다 (최대 50,000자).",
  pending_action_insert_failed: "저장 요청을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default function QuickCapture() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [explicit, setExplicit] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "idle" });

    const res = await fetch("/api/memos/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        title: title.trim() || null,
        source_type: "quick_capture",
        explicit,
      }),
    });

    if (res.status === 401) {
      setStatus({ kind: "error", message: "세션이 만료되었습니다. 다시 로그인해 주세요." });
      return;
    }
    if (res.status === 400) {
      setStatus({ kind: "error", message: "입력 형식이 올바르지 않습니다." });
      return;
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      setStatus({ kind: "error", message: "서버 응답을 해석하지 못했습니다." });
      return;
    }

    if (res.status === 409 && isBlocked(data)) {
      setStatus({ kind: "blocked", reason: data.reason });
      return;
    }
    if (res.status === 202 && isPendingResp(data)) {
      setStatus({ kind: "pending", sensitivity_flag: data.sensitivity_flag });
      setContent("");
      setTitle("");
      startTransition(() => router.refresh());
      return;
    }
    setStatus({ kind: "error", message: `예기치 못한 응답 (${res.status}).` });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
    >
      <div className="space-y-1">
        <label htmlFor="memo-title" className="text-xs opacity-70">
          제목 (선택)
        </label>
        <input
          id="memo-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="짧은 제목"
          className="w-full rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15"
          maxLength={500}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="memo-content" className="text-xs opacity-70">
          메모 내용
        </label>
        <textarea
          id="memo-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예: 이 내용 메모해줘 — 다음 회의 전까지 초안 완성"
          rows={4}
          className="w-full resize-y rounded border border-black/15 bg-transparent px-2 py-2 text-sm dark:border-white/15"
          maxLength={50_000}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-xs opacity-80">
        <input
          type="checkbox"
          checked={explicit}
          onChange={(e) => setExplicit(e.target.checked)}
        />
        <span>이 내용을 메모로 저장 요청합니다 (명시 저장)</span>
      </label>
      <div className="flex items-center justify-between gap-3">
        <StatusLine status={status} isPending={isPending} />
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="rounded bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-50"
        >
          저장 요청
        </button>
      </div>
    </form>
  );
}

function StatusLine({ status, isPending }: { status: Status; isPending: boolean }) {
  if (isPending) return <span className="text-xs opacity-60">처리 중…</span>;
  switch (status.kind) {
    case "idle":
      return <span className="text-xs opacity-50">명시 저장만 승인 대기로 진행됩니다.</span>;
    case "pending":
      return (
        <span className="text-xs">
          저장안이 승인 대기열로 이동했습니다.
          {status.sensitivity_flag ? " 민감정보 가능성이 감지되었습니다." : ""}
        </span>
      );
    case "blocked":
      return (
        <span className="text-xs text-amber-700 dark:text-amber-400">
          차단됨: {BLOCK_MESSAGES[status.reason] ?? status.reason}
        </span>
      );
    case "error":
      return <span className="text-xs text-red-600 dark:text-red-400">{status.message}</span>;
  }
}

function isBlocked(data: unknown): data is { status: "blocked"; reason: string } {
  return (
    !!data &&
    typeof data === "object" &&
    "status" in data &&
    (data as { status: unknown }).status === "blocked" &&
    "reason" in data &&
    typeof (data as { reason: unknown }).reason === "string"
  );
}

function isPendingResp(
  data: unknown,
): data is { status: "pending"; pending_action_id: string; sensitivity_flag: boolean } {
  return (
    !!data &&
    typeof data === "object" &&
    "status" in data &&
    (data as { status: unknown }).status === "pending"
  );
}
