"use client";

import { useEffect, useState } from "react";

import {
  isDocumentProcessingTerminal,
  processingBackoffMs,
} from "@/lib/documents/upload-status";
import type { DocumentDetailPayload } from "@/types/document";

export {
  isDocumentProcessingTerminal,
  isPipelineFailedSnapshot,
  formatParsingErrorHint,
  processingBackoffMs,
} from "@/lib/documents/upload-status";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isDetailBody(body: unknown): body is { document: DocumentDetailPayload } {
  return isRecord(body) && isRecord(body.document) && typeof body.document.id === "string";
}

export async function fetchDocumentProcessingSnapshot(
  documentId: string,
): Promise<DocumentDetailPayload | null> {
  try {
    const res = await fetch(`/api/documents/${documentId}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isDetailBody(body) ? body.document : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const DEFAULT_MAX_ELAPSED_MS = 180_000;

/**
 * 지수 백오프 + 최대 경과 시간. `fetch_failed` 는 한 번이라도 스냅샷을 못 받으면 즉시 반환.
 */
export async function pollDocumentUntilTerminal(
  documentId: string,
  options: {
    signal?: AbortSignal;
    maxElapsedMs?: number;
    onSnapshot?: (doc: DocumentDetailPayload, attempt: number) => void;
  } = {},
): Promise<
  | { ok: true; document: DocumentDetailPayload }
  | { ok: false; reason: "timeout" | "fetch_failed" | "aborted" }
> {
  const maxElapsed = options.maxElapsedMs ?? DEFAULT_MAX_ELAPSED_MS;
  const started = Date.now();
  let attempt = 0;

  while (Date.now() - started < maxElapsed) {
    if (options.signal?.aborted) {
      return { ok: false, reason: "aborted" };
    }
    const doc = await fetchDocumentProcessingSnapshot(documentId);
    if (!doc) {
      return { ok: false, reason: "fetch_failed" };
    }
    options.onSnapshot?.(doc, attempt);
    if (isDocumentProcessingTerminal(doc)) {
      return { ok: true, document: doc };
    }
    const delay = processingBackoffMs(attempt);
    await sleep(delay);
    attempt++;
  }
  return { ok: false, reason: "timeout" };
}

/**
 * 단일 document id 스냅샷 폴링(마운트 시).
 */
export function useDocumentProcessingStatus(documentId: string | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<DocumentDetailPayload | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!documentId || !enabled) {
      queueMicrotask(() => {
        setPolling(false);
        setSnapshot(null);
      });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const step = async (attempt: number) => {
      const doc = await fetchDocumentProcessingSnapshot(documentId);
      if (cancelled || !doc) return;
      setSnapshot(doc);
      if (isDocumentProcessingTerminal(doc)) {
        setPolling(false);
        return;
      }
      setPolling(true);
      const delay = processingBackoffMs(attempt);
      timer = setTimeout(() => void step(attempt + 1), delay);
    };

    queueMicrotask(() => {
      setPolling(true);
      void step(0);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [documentId, enabled]);

  return { snapshot, polling };
}
