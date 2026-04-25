"use client";

/**
 * 문서 업로드·처리 UX 진입점(훅·폴링·상태 판정 재export).
 */

export { useDocumentUploadQueue } from "./useDocumentUploadQueue";
export type {
  DuplicateDocumentHint,
  QueueRow,
  QueueRowStatus,
  UseDocumentUploadQueueResult,
} from "./useDocumentUploadQueue";

export {
  fetchDocumentProcessingSnapshot,
  pollDocumentUntilTerminal,
  useDocumentProcessingStatus,
} from "./useDocumentProcessingStatus";
