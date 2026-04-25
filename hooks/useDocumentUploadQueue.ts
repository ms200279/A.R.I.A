"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { computeFileSha256Hex } from "@/lib/client/file-sha256";
import { uploadDocumentWithProgress } from "@/lib/client/document-upload-xhr";
import { validateDocumentUpload } from "@/lib/documents/supported-file-types";
import { formatParsingErrorHint, isPipelineFailedSnapshot } from "@/lib/documents/upload-status";
import type { DocumentDetailPayload, DocumentUploadErrorResponse } from "@/types/document";

import { pollDocumentUntilTerminal } from "./useDocumentProcessingStatus";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isUploadErrorBody(body: unknown): body is DocumentUploadErrorResponse {
  return isRecord(body) && typeof body.error === "string";
}

const REASON_MESSAGES_KO: Record<string, string> = {
  missing_file_name: "파일 이름이 없습니다.",
  empty_file: "빈 파일은 올릴 수 없습니다.",
  file_too_large: "파일이 너무 큽니다(최대 5MB).",
  unsupported_file_type: "지원하지 않는 형식입니다. .txt 또는 .md만 올려 주세요.",
  unsupported_format: "내용을 파싱할 수 없는 형식입니다.",
  empty_text: "추출된 텍스트가 없습니다.",
  decode_error: "파일 디코딩에 실패했습니다.",
  empty_after_preprocess: "전처리 후 내용이 비어 처리할 수 없습니다.",
  size_mismatch: "파일 크기가 일치하지 않습니다. 다시 선택해 주세요.",
  document_row_insert_failed: "문서 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  storage_upload_failed: "파일 저장소 업로드에 실패했습니다.",
  chunk_insert_failed: "문서 청크 저장에 실패했습니다.",
  missing_file: "파일을 선택해 주세요.",
  invalid_multipart: "요청 형식이 올바르지 않습니다.",
  unauthorized: "로그인이 필요합니다.",
};

function messageForReason(code: string, fallback: string): string {
  return REASON_MESSAGES_KO[code] ?? fallback;
}

export type DuplicateDocumentHint = {
  id: string;
  title: string | null;
  file_name: string | null;
};

export type QueueRowStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "canceled"
  | "timeout";

export type QueueRow = {
  id: string;
  file: File;
  title: string | null;
  status: QueueRowStatus;
  /** 업로드 바이트 구간만 수치. 서버 처리 중은 null(비정밀). */
  progress: number | null;
  errorMessage: string | null;
  errorDocumentId: string | null;
  documentId: string | null;
  snapshot: DocumentDetailPayload | null;
  duplicateOf: DuplicateDocumentHint | null;
};

function newRowId(): string {
  return crypto.randomUUID();
}

function mapXhrError(status: number, body: unknown): { message: string; docId: string | null } {
  if (body === "aborted") {
    return { message: "", docId: null };
  }
  if (isUploadErrorBody(body)) {
    const docId =
      typeof body.document_id === "string" && body.document_id.trim()
        ? body.document_id.trim()
        : null;
    return {
      message: messageForReason(body.error, "업로드에 실패했습니다."),
      docId,
    };
  }
  if (status === 0) {
    return { message: "네트워크 오류가 발생했습니다.", docId: null };
  }
  return {
    message: `서버 응답 ${status}. 잠시 후 다시 시도해 주세요.`,
    docId: null,
  };
}

async function lookupDuplicate(hex: string): Promise<DuplicateDocumentHint | null> {
  try {
    const res = await fetch(`/api/documents/lookup?sha256=${encodeURIComponent(hex)}`, {
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!isRecord(body) || body.document == null) return null;
    const d = body.document as Record<string, unknown>;
    if (typeof d.id !== "string") return null;
    return {
      id: d.id,
      title: typeof d.title === "string" ? d.title : null,
      file_name: typeof d.file_name === "string" ? d.file_name : null,
    };
  } catch {
    return null;
  }
}

export type UseDocumentUploadQueueResult = {
  rows: QueueRow[];
  optionalTitle: string;
  setOptionalTitle: (v: string) => void;
  lastValidationErrors: string[];
  clearLastValidationErrors: () => void;
  enqueueFiles: (files: File[]) => Promise<void>;
  removeQueued: (rowId: string) => void;
  cancelRow: (rowId: string) => void;
  retryPoll: (rowId: string) => void;
  clearTerminal: () => void;
  workerRunning: boolean;
};

export function useDocumentUploadQueue(
  onPipelineEvent: (kind: "ready" | "failed" | "poll_timeout") => void,
): UseDocumentUploadQueueResult {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [optionalTitle, setOptionalTitle] = useState("");
  const [lastValidationErrors, setLastValidationErrors] = useState<string[]>([]);
  const [workerRunning, setWorkerRunning] = useState(false);

  const onPipelineEventRef = useRef(onPipelineEvent);
  const rowsRef = useRef(rows);
  const abortByRowRef = useRef(new Map<string, AbortController>());

  useLayoutEffect(() => {
    onPipelineEventRef.current = onPipelineEvent;
  }, [onPipelineEvent]);

  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const ref = abortByRowRef;
    return () => {
      const pending = new Map(ref.current);
      for (const ac of pending.values()) {
        ac.abort();
      }
      ref.current.clear();
    };
  }, []);

  const workerLock = useRef(false);

  const clearLastValidationErrors = useCallback(() => setLastValidationErrors([]), []);

  const runPollPhase = useCallback(
    async (rowId: string, docId: string, ac: AbortSignal) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, status: "processing", progress: null, errorMessage: null }
            : r,
        ),
      );

      const poll = await pollDocumentUntilTerminal(docId, {
        signal: ac,
        onSnapshot: (doc) => {
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, snapshot: doc, status: "processing", progress: null } : r,
            ),
          );
        },
      });

      if (!poll.ok) {
        if (poll.reason === "aborted") {
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? {
                    ...r,
                    status: "canceled",
                    progress: null,
                    documentId: docId,
                    errorDocumentId: docId,
                    errorMessage:
                      "처리 상태 확인을 중단했습니다. 서버에는 문서가 이미 있을 수 있습니다. 상세에서 확인해 주세요.",
                  }
                : r,
            ),
          );
          return;
        }
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  status: "timeout",
                  progress: null,
                  documentId: docId,
                  errorDocumentId: docId,
                  errorMessage:
                    poll.reason === "fetch_failed"
                      ? "상태를 불러오지 못했습니다. 다시 확인을 눌러 주세요."
                      : "확인 시간이 초과되었습니다. 다시 확인하거나 문서 상세를 열어 주세요.",
                }
              : r,
          ),
        );
        onPipelineEventRef.current("poll_timeout");
        return;
      }

      const finalDoc = poll.document;
      const hint = formatParsingErrorHint(finalDoc.parsing_error_code);
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                snapshot: finalDoc,
                documentId: docId,
                progress: 100,
                status: isPipelineFailedSnapshot(finalDoc) ? "failed" : "ready",
                errorMessage: isPipelineFailedSnapshot(finalDoc)
                  ? `처리에 실패했습니다.${hint ? ` (${hint})` : ""} 상세에서 확인해 주세요.`
                  : null,
                errorDocumentId: isPipelineFailedSnapshot(finalDoc) ? docId : null,
              }
            : r,
        ),
      );

      if (isPipelineFailedSnapshot(finalDoc)) {
        onPipelineEventRef.current("failed");
      } else {
        onPipelineEventRef.current("ready");
      }
    },
    [],
  );

  const enqueueFiles = useCallback(
    async (files: File[]) => {
      clearLastValidationErrors();
      const list = [...files];
      const errors: string[] = [];
      const toAdd: QueueRow[] = [];
      const ot = optionalTitle.trim();

      for (const [idx, file] of list.entries()) {
        const gate = validateDocumentUpload({
          fileName: file.name,
          declaredMime: file.type ?? "",
          sizeBytes: file.size,
        });
        if (!gate.ok) {
          errors.push(`${file.name}: ${messageForReason(gate.reason, "거부됨")}`);
          continue;
        }
        let duplicateOf: DuplicateDocumentHint | null = null;
        try {
          const hex = await computeFileSha256Hex(file);
          duplicateOf = await lookupDuplicate(hex);
        } catch {
          /* 해시·조회 실패는 업로드 자체를 막지 않음 */
        }
        toAdd.push({
          id: newRowId(),
          file,
          title: idx === 0 && ot ? ot : null,
          status: "queued",
          progress: 0,
          errorMessage: null,
          errorDocumentId: null,
          documentId: null,
          snapshot: null,
          duplicateOf,
        });
      }

      if (errors.length) setLastValidationErrors(errors);
      if (toAdd.length) setRows((prev) => [...prev, ...toAdd]);
    },
    [clearLastValidationErrors, optionalTitle],
  );

  const removeQueued = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => !(r.id === rowId && r.status === "queued")));
  }, []);

  const cancelRow = useCallback((rowId: string) => {
    const ac = abortByRowRef.current.get(rowId);
    ac?.abort();
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (r.status === "uploading" || r.status === "uploaded" || r.status === "processing") {
          return {
            ...r,
            status: "canceled",
            progress: null,
            errorDocumentId: r.documentId,
            errorMessage:
              "업로드 또는 처리 확인을 취소했습니다. 서버에 문서가 이미 생성되었을 수 있으면 목록·상세에서 확인해 주세요.",
          };
        }
        return r;
      }),
    );
    abortByRowRef.current.delete(rowId);
  }, []);

  const retryPoll = useCallback(
    (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row?.documentId || row.status !== "timeout") return;
      const ac = new AbortController();
      abortByRowRef.current.set(rowId, ac);
      void runPollPhase(rowId, row.documentId, ac.signal).finally(() => {
        abortByRowRef.current.delete(rowId);
      });
    },
    [runPollPhase],
  );

  const clearTerminal = useCallback(() => {
    setRows((prev) =>
      prev.filter(
        (r) =>
          !["ready", "failed", "timeout", "canceled"].includes(r.status),
      ),
    );
  }, []);

  const processOne = useCallback(
    async (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row || row.status !== "queued") return;

      const ac = new AbortController();
      abortByRowRef.current.set(rowId, ac);

      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, status: "uploading", progress: 0 } : r)),
      );

      const xhrRes = await uploadDocumentWithProgress(row.file, {
        signal: ac.signal,
        title: row.title,
        onUploadProgress: (p) => {
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, progress: Math.round(Math.min(100, Math.max(0, p))), status: "uploading" } : r,
            ),
          );
        },
      });

      if (!xhrRes.ok) {
        if (xhrRes.body === "aborted") {
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? {
                    ...r,
                    status: "canceled",
                    progress: null,
                    errorMessage: "업로드를 취소했습니다.",
                  }
                : r,
            ),
          );
          abortByRowRef.current.delete(rowId);
          return;
        }
        const { message, docId } = mapXhrError(xhrRes.status, xhrRes.body);
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  status: "failed",
                  progress: null,
                  errorMessage: message,
                  errorDocumentId: docId,
                  documentId: docId,
                }
              : r,
          ),
        );
        onPipelineEventRef.current("failed");
        abortByRowRef.current.delete(rowId);
        return;
      }

      const docId = xhrRes.document.id;

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                status: "uploaded",
                progress: 100,
                documentId: docId,
              }
            : r,
        ),
      );

      await runPollPhase(rowId, docId, ac.signal);
      abortByRowRef.current.delete(rowId);
    },
    [runPollPhase],
  );

  const pump = useCallback(async () => {
    if (workerLock.current) return;
    const next = rowsRef.current.find((r) => r.status === "queued");
    if (!next) {
      setWorkerRunning(false);
      return;
    }
    workerLock.current = true;
    setWorkerRunning(true);
    try {
      await processOne(next.id);
    } finally {
      workerLock.current = false;
      setTimeout(() => {
        const hasQueued = rowsRef.current.some((r) => r.status === "queued");
        const busy = rowsRef.current.some((r) =>
          ["queued", "uploading", "uploaded", "processing"].includes(r.status),
        );
        setWorkerRunning(busy);
        if (hasQueued) void pump();
      }, 0);
    }
  }, [processOne]);

  useEffect(() => {
    const hasQueued = rows.some((r) => r.status === "queued");
    if (hasQueued && !workerLock.current) {
      setTimeout(() => void pump(), 0);
    }
  }, [rows, pump]);

  return {
    rows,
    optionalTitle,
    setOptionalTitle,
    lastValidationErrors,
    clearLastValidationErrors,
    enqueueFiles,
    removeQueued,
    cancelRow,
    retryPoll,
    clearTerminal,
    workerRunning,
  };
}
