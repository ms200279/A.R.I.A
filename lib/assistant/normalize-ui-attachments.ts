import {
  parseLooseComparisonHistoryDetail,
  parseLooseComparisonHistoryListItem,
} from "@/lib/documents/parse-comparison-dto";
import type { AssistantMessageAttachment } from "@/types/assistant-attachments";

const PREVIEW_HARD_MAX = 480;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function clamp(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * API `ui_attachments` 를 클라이언트 카드 타입으로 안전히 변환. 실패 항목은 건너뜀.
 */
export function parseAssistantUiAttachments(raw: unknown): AssistantMessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantMessageAttachment[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    const kind = item.kind;
    if (kind === "comparison_history_item") {
      if (typeof item.context_document_id !== "string") continue;
      const payload = parseLooseComparisonHistoryListItem(item.item);
      if (!payload) continue;
      out.push({
        kind: "comparison_history_item",
        context_document_id: item.context_document_id,
        item: {
          ...payload,
          content_preview: clamp(payload.content_preview, PREVIEW_HARD_MAX),
        },
      });
      continue;
    }
    if (kind === "comparison_detail") {
      if (typeof item.context_document_id !== "string") continue;
      const data = parseLooseComparisonHistoryDetail(item.data);
      if (!data) continue;
      out.push({
        kind: "comparison_detail",
        context_document_id: item.context_document_id,
        data,
      });
      continue;
    }
    if (kind === "document_latest_comparison_card") {
      if (typeof item.documentId !== "string" || typeof item.comparisonSummaryId !== "string") {
        continue;
      }
      const preview =
        typeof item.contentPreview === "string" ? clamp(item.contentPreview, PREVIEW_HARD_MAX) : "";
      if (!preview) continue;
      out.push({
        kind: "document_latest_comparison_card",
        documentId: item.documentId,
        documentTitle: typeof item.documentTitle === "string" ? item.documentTitle : null,
        comparisonSummaryId: item.comparisonSummaryId,
        contentPreview: preview,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        comparisonHistoryId:
          typeof item.comparisonHistoryId === "string" ? item.comparisonHistoryId : null,
        relatedDocumentIds: Array.isArray(item.relatedDocumentIds)
          ? item.relatedDocumentIds.filter((x): x is string => typeof x === "string").slice(0, 8)
          : undefined,
      });
      continue;
    }
    if (kind === "document_latest_analysis_card") {
      if (typeof item.documentId !== "string" || typeof item.analysisSummaryId !== "string") {
        continue;
      }
      const preview =
        typeof item.contentPreview === "string" ? clamp(item.contentPreview, PREVIEW_HARD_MAX) : "";
      if (!preview) continue;
      const keyPoints = Array.isArray(item.keyPoints)
        ? item.keyPoints.filter((x): x is string => typeof x === "string").slice(0, 6)
        : undefined;
      out.push({
        kind: "document_latest_analysis_card",
        documentId: item.documentId,
        documentTitle: typeof item.documentTitle === "string" ? item.documentTitle : null,
        analysisSummaryId: item.analysisSummaryId,
        contentPreview: preview,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        keyPoints: keyPoints && keyPoints.length > 0 ? keyPoints : undefined,
      });
    }
  }

  return out;
}
