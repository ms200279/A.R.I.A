"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SaveMemoPending } from "@/types/pending-action";

type LocalStatus =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "rejecting" }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; message: string }
  | { kind: "success"; memoId: string };

export default function PendingItem({ item }: { item: SaveMemoPending }) {
  const router = useRouter();
  const [status, setStatus] = useState<LocalStatus>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const [confirmedStrong, setConfirmedStrong] = useState(!item.sensitivity_flag);

  const busy = status.kind === "confirming" || status.kind === "rejecting" || isPending;

  async function call(path: "confirm" | "reject") {
    setStatus({ kind: path === "confirm" ? "confirming" : "rejecting" });
    const res = await fetch(`/api/approvals/${item.id}/${path}`, {
      method: "POST",
    });

    // HTTP 200 + body.status === "blocked" 는 정책적 차단. 오류가 아니므로 별도 처리.
    if (res.ok) {
      try {
        const body = (await res.json()) as {
          status?: string;
          reason?: string;
          memo_id?: string;
        };
        if (body?.status === "blocked") {
          setStatus({
            kind: "blocked",
            reason: body.reason ?? "blocked",
          });
          startTransition(() => router.refresh());
          return;
        }
        if (body?.status === "executed" && body.memo_id) {
          setStatus({ kind: "success", memoId: body.memo_id });
          startTransition(() => router.refresh());
          return;
        }
      } catch {
        // 빈 응답이어도 성공으로 간주
      }
      setStatus({ kind: "idle" });
      startTransition(() => router.refresh());
      return;
    }

    let reason = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: string;
        current_status?: string;
      };
      if (res.status === 409 && body?.current_status) {
        reason = `이미 처리됨 (상태: ${body.current_status})`;
      } else if (body?.error) reason = body.error;
    } catch {
      /* keep default */
    }
    setStatus({ kind: "error", message: reason });
  }

  return (
    <article className="space-y-2 rounded border border-black/10 p-4 text-sm dark:border-white/10">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {item.payload.title ? (
            <p className="font-medium">{item.payload.title}</p>
          ) : (
            <p className="text-xs opacity-50">(제목 없음)</p>
          )}
          <p className="text-xs opacity-60">
            요청 시각 {new Date(item.created_at).toLocaleString()}
            {item.payload.project_key ? ` · project: ${item.payload.project_key}` : ""}
            {item.payload.tags?.length ? ` · tags: ${item.payload.tags.join(", ")}` : ""}
          </p>
        </div>
        {item.sensitivity_flag && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            민감정보 의심
          </span>
        )}
      </header>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/5 p-2 text-xs dark:bg-white/5">
        {item.payload.content}
      </pre>

      {item.sensitivity_flag && !confirmedStrong && (
        <label className="flex items-start gap-2 text-xs opacity-80">
          <input
            type="checkbox"
            checked={confirmedStrong}
            onChange={(e) => setConfirmedStrong(e.target.checked)}
          />
          <span>민감정보가 포함될 수 있음을 확인하였고, 그래도 저장을 승인합니다.</span>
        </label>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <LocalStatusLine status={status} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => call("reject")}
            disabled={busy || status.kind === "success"}
            className="rounded border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
          >
            거절
          </button>
          <button
            type="button"
            onClick={() => call("confirm")}
            disabled={busy || !confirmedStrong || status.kind === "success"}
            className="rounded bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-50"
          >
            승인
          </button>
        </div>
      </div>
    </article>
  );
}

function LocalStatusLine({ status }: { status: LocalStatus }) {
  switch (status.kind) {
    case "idle":
      return <span className="text-xs opacity-0">.</span>;
    case "confirming":
      return <span className="text-xs opacity-60">승인 처리 중…</span>;
    case "rejecting":
      return <span className="text-xs opacity-60">거절 처리 중…</span>;
    case "success":
      return (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          저장되었습니다.{" "}
          <Link href={`/memos/${status.memoId}` as Route} className="underline underline-offset-2">
            메모 열기
          </Link>
        </span>
      );
    case "blocked":
      return (
        <span className="text-xs text-amber-600 dark:text-amber-400">차단됨: {status.reason}</span>
      );
    case "error":
      return (
        <span className="text-xs text-red-600 dark:text-red-400">처리 실패: {status.message}</span>
      );
  }
}
