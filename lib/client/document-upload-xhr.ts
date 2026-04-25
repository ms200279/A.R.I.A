"use client";

import type { Document, DocumentUploadSuccessResponse } from "@/types/document";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isUploadSuccessBody(body: unknown): body is DocumentUploadSuccessResponse {
  if (!isRecord(body) || !isRecord(body.document)) return false;
  return typeof body.document.id === "string";
}

export type DocumentXhrUploadResult =
  | { ok: true; document: Document }
  | { ok: false; status: number; body: unknown };

/**
 * POST /api/documents/upload — XMLHttpRequest + upload.onprogress.
 * `signal` 이 abort 되면 전송을 끊고 `body: "aborted"` 로 반환한다.
 */
export function uploadDocumentWithProgress(
  file: File,
  options: {
    signal?: AbortSignal;
    title?: string | null;
    /** 업로드 바이트 구간만 0–100 */
    onUploadProgress?: (percent: number) => void;
  } = {},
): Promise<DocumentXhrUploadResult> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ ok: false, status: 0, body: "aborted" });
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.responseType = "json";

    const onAbort = () => xhr.abort();
    options.signal?.addEventListener("abort", onAbort);

    xhr.upload.onprogress = (ev) => {
      if (!options.onUploadProgress) return;
      if (ev.lengthComputable && ev.total > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((ev.loaded / ev.total) * 100)));
        options.onUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      options.signal?.removeEventListener("abort", onAbort);
      const raw = xhr.response;
      if (xhr.status === 201 && isUploadSuccessBody(raw)) {
        resolve({ ok: true, document: raw.document });
        return;
      }
      resolve({ ok: false, status: xhr.status, body: raw });
    };

    xhr.onerror = () => {
      options.signal?.removeEventListener("abort", onAbort);
      resolve({ ok: false, status: 0, body: null });
    };

    xhr.onabort = () => {
      options.signal?.removeEventListener("abort", onAbort);
      resolve({ ok: false, status: 0, body: "aborted" });
    };

    const fd = new FormData();
    fd.set("file", file);
    const t = options.title?.trim();
    if (t) fd.set("title", t);

    xhr.send(fd);
  });
}
