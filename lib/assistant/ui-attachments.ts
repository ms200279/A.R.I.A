import "server-only";

import {
  tryParseAnalysisResult,
  tryParseCompareResult,
} from "@/lib/documents/parse-stored-document-results";
import type { AssistantMessageAttachment } from "@/types/assistant-attachments";

const PREVIEW_MAX = 220;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function clampPreview(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function mergeAttachment(
  list: AssistantMessageAttachment[],
  next: AssistantMessageAttachment,
): AssistantMessageAttachment[] {
  const docId = "documentId" in next ? next.documentId : "";
  const idx = list.findIndex((x) => x.kind === next.kind && "documentId" in x && x.documentId === docId);
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = next;
    return copy;
  }
  return [...list, next];
}

export function mergeDocumentDetailAttachments(
  existing: AssistantMessageAttachment[],
  payload: unknown,
): AssistantMessageAttachment[] {
  const fresh = collectAttachmentsFromGetDocumentDetailPayload(payload);
  let out = [...existing];
  for (const a of fresh) {
    out = mergeAttachment(out, a);
  }
  return out;
}

/**
 * `get_document_detail` 도구 `payload`(모델용 projection 포함)에서 카드 payload 추출.
 */
export function collectAttachmentsFromGetDocumentDetailPayload(
  payload: unknown,
): AssistantMessageAttachment[] {
  if (!isRecord(payload) || !isRecord(payload.document)) return [];
  const doc = payload.document;
  const documentId = typeof doc.id === "string" ? doc.id : null;
  if (!documentId) return [];

  const title: string | null =
    typeof doc.title === "string" && doc.title.trim()
      ? doc.title.trim()
      : typeof doc.file_name === "string"
        ? doc.file_name
        : null;

  const out: AssistantMessageAttachment[] = [];

  const lc = doc.latest_comparison;
  if (isRecord(lc) && typeof lc.id === "string" && typeof lc.content === "string") {
    const contentPreview = comparisonContentPreview(lc.content);
    if (contentPreview.length > 0) {
      const parsed = tryParseCompareResult(lc.content);
      out.push({
        kind: "document_latest_comparison_card",
        documentId,
        documentTitle: title,
        comparisonSummaryId: lc.id,
        contentPreview,
        createdAt: typeof lc.created_at === "string" ? lc.created_at : "",
        comparisonHistoryId: null,
        relatedDocumentIds: parsed?.compared_document_ids?.length
          ? parsed.compared_document_ids.slice(0, 6)
          : undefined,
      });
    }
  }

  const la = doc.latest_analysis;
  if (isRecord(la) && typeof la.id === "string" && typeof la.content === "string") {
    const parsed = tryParseAnalysisResult(la.content);
    const body = parsed?.analysis ?? la.content;
    const contentPreview = clampPreview(body, PREVIEW_MAX);
    if (contentPreview.length > 0) {
      const kps = parsed?.key_points?.filter((x): x is string => typeof x === "string").slice(0, 4);
      out.push({
        kind: "document_latest_analysis_card",
        documentId,
        documentTitle: title,
        analysisSummaryId: la.id,
        contentPreview,
        createdAt: typeof la.created_at === "string" ? la.created_at : "",
        keyPoints: kps && kps.length > 0 ? kps : undefined,
      });
    }
  }

  return out;
}

function comparisonContentPreview(content: string): string {
  const parsed = tryParseCompareResult(content);
  if (parsed) {
    const parts = [
      parsed.summary_of_differences,
      parsed.summary_of_common_points,
    ].filter((s) => s.trim().length > 0);
    return clampPreview(parts.join(" · "), PREVIEW_MAX);
  }
  return clampPreview(content, PREVIEW_MAX);
}
