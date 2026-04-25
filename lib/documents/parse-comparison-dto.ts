import type {
  ComparisonHistoryDetailPayload,
  ComparisonHistoryListItemPayload,
} from "@/types/comparisons";

import { normalizeComparisonAnchorRole } from "./comparison-anchor-role";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * 외부·캐시·레거시 JSON 을 `ComparisonHistoryListItemPayload` 로 안전히 맞춘다.
 * assistant `ui_attachments` normalize 용.
 */
export function parseLooseComparisonHistoryListItem(
  raw: unknown,
): ComparisonHistoryListItemPayload | null {
  if (!isRecord(raw)) return null;
  const comparison_id = typeof raw.comparison_id === "string" ? raw.comparison_id : null;
  const created_at = typeof raw.created_at === "string" ? raw.created_at : null;
  if (!comparison_id || !created_at) return null;

  const primary_document_id =
    typeof raw.primary_document_id === "string" ? raw.primary_document_id : "";
  return {
    comparison_id,
    summary_id: typeof raw.summary_id === "string" ? raw.summary_id : null,
    primary_document_id,
    created_at,
    document_count:
      typeof raw.document_count === "number" && Number.isFinite(raw.document_count)
        ? Math.max(0, raw.document_count)
        : 0,
    other_documents_preview:
      typeof raw.other_documents_preview === "string" ? raw.other_documents_preview : "—",
    content_preview: typeof raw.content_preview === "string" ? raw.content_preview : "",
    current_document_anchor_role: normalizeComparisonAnchorRole(
      typeof raw.current_document_anchor_role === "string"
        ? raw.current_document_anchor_role
        : null,
    ),
    current_document_sort_order:
      typeof raw.current_document_sort_order === "number" &&
      Number.isFinite(raw.current_document_sort_order)
        ? raw.current_document_sort_order
        : null,
  };
}

/**
 * assistant 가 비교 상세 DTO 를 실었을 때 최소 스키마 검증(깨진 JSON 방지).
 */
export function parseLooseComparisonHistoryDetail(
  raw: unknown,
): ComparisonHistoryDetailPayload | null {
  if (!isRecord(raw)) return null;
  const comparison_id = typeof raw.comparison_id === "string" ? raw.comparison_id : null;
  const created_at = typeof raw.created_at === "string" ? raw.created_at : null;
  const updated_at = typeof raw.updated_at === "string" ? raw.updated_at : created_at;
  if (!comparison_id || typeof raw.content !== "string" || !created_at || !updated_at) return null;
  const content = raw.content;

  const documents: ComparisonHistoryDetailPayload["documents"] = [];
  if (Array.isArray(raw.documents)) {
    for (const row of raw.documents) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      const sort =
        typeof row.sort_order === "number" && Number.isFinite(row.sort_order)
          ? row.sort_order
          : 0;
      documents.push({
        id: row.id,
        title: typeof row.title === "string" ? row.title : null,
        file_name: typeof row.file_name === "string" ? row.file_name : null,
        anchor_role: normalizeComparisonAnchorRole(
          typeof row.anchor_role === "string" ? row.anchor_role : null,
        ),
        sort_order: sort,
      });
    }
  }

  const base: ComparisonHistoryDetailPayload = {
    comparison_id,
    summary_id: typeof raw.summary_id === "string" ? raw.summary_id : null,
    primary_document_id:
      typeof raw.primary_document_id === "string" ? raw.primary_document_id : "",
    created_at,
    updated_at,
    content,
    source_ranges:
      raw.source_ranges !== undefined && raw.source_ranges !== null && isRecord(raw.source_ranges)
        ? raw.source_ranges
        : null,
    documents,
  };

  if (isRecord(raw.current_context)) {
    const cc = raw.current_context;
    const document_id = typeof cc.document_id === "string" ? cc.document_id : null;
    if (document_id) {
      const sort =
        typeof cc.sort_order === "number" && Number.isFinite(cc.sort_order) ? cc.sort_order : null;
      base.current_context = {
        document_id,
        anchor_role: normalizeComparisonAnchorRole(
          typeof cc.anchor_role === "string" ? cc.anchor_role : null,
        ),
        sort_order: sort,
      };
    }
  }

  return base;
}
