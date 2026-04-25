/**
 * 문서 업로드 직후 파이프라인 상태 판정(서버/클라이언트 공용, fetch 없음).
 */

import type { DocumentDetailPayload } from "@/types/document";

/** 지수 백오프 지연(ms). attempt 0부터. */
export function processingBackoffMs(
  attemptIndex: number,
  opts?: { initialMs?: number; maxMs?: number },
): number {
  const initial = opts?.initialMs ?? 1_200;
  const max = opts?.maxMs ?? 10_000;
  return Math.min(max, Math.round(initial * Math.pow(2, attemptIndex)));
}

/**
 * 폴링을 멈출지(성공·실패·안정 종료).
 * `DocumentDetailPayload.status` 가 있으면 행 수준 실패도 반영한다.
 */
export function isDocumentProcessingTerminal(d: DocumentDetailPayload): boolean {
  if (d.status === "failed" || d.status === "archived") return true;

  const parse = d.parsing_status;
  if (parse === "failed" || parse === "unsupported_format" || parse === "blocked") {
    return true;
  }

  const pre = d.preprocessing_status;
  if (pre === "failed" || pre === "blocked") return true;

  const sum = d.summary_status;
  if (sum === "failed") return true;

  if (parse !== "complete") return false;
  if (pre !== "complete") return false;
  if (sum === "pending" || sum === "in_progress") return false;

  // 파이프라인 필드가 안정된 뒤에는 행이 active 일 때만 폴링 종료(processing 이면 DB 반영 대기)
  return d.status === "active";
}

/** 사용자에게 실패로 보여야 하는 스냅샷(배지·메시지). */
export function isPipelineFailedSnapshot(d: DocumentDetailPayload): boolean {
  if (d.status === "failed" || d.status === "archived") return true;
  const parse = d.parsing_status;
  if (parse === "failed" || parse === "unsupported_format" || parse === "blocked") return true;
  const pre = d.preprocessing_status;
  if (pre === "failed" || pre === "blocked") return true;
  if (d.summary_status === "failed") return true;
  return false;
}

export function formatParsingErrorHint(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return code.trim();
}
