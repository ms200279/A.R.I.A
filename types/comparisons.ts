/**
 * 비교 히스토리 read-side DTO. API·RSC·assistant 인라인 카드가 동일 계약을 공유한다.
 * `comparison_history_documents.anchor_role` / sort_order·조인 기준( primary_document_id 단순 비교 아님 ).
 */

/**
 * DB check 제약 + 향후 마이그레이션 시 union 확장(예: secondary).
 * `lib/documents/comparison-anchor-role` 의 정규화로 알 수 없는 값은 null 로 매핑.
 */
export type ComparisonAnchorRole = "primary" | "peer";

export type ComparisonHistoryCurrentContext = {
  document_id: string;
  anchor_role: ComparisonAnchorRole | null;
  sort_order: number | null;
};

/** GET /api/comparisons/[id] (및 RSC 상세) 본문. */
export type ComparisonHistoryDetailPayload = {
  comparison_id: string;
  summary_id: string | null;
  primary_document_id: string;
  created_at: string;
  updated_at: string;
  content: string;
  source_ranges: Record<string, unknown> | null;
  documents: Array<{
    id: string;
    title: string | null;
    file_name: string | null;
    anchor_role: ComparisonAnchorRole | null;
    sort_order: number;
  }>;
  /** `from` / `context_document_id` 가 있을 때만 설정. */
  current_context?: ComparisonHistoryCurrentContext;
};

/** `ComparisonHistoryDetailPayload` 와 동일(짧은 별칭). */
export type ComparisonDetailPayload = ComparisonHistoryDetailPayload;

/** GET /api/documents/[id]/comparisons 목록 항목. */
export type ComparisonHistoryListItemPayload = {
  comparison_id: string;
  summary_id: string | null;
  primary_document_id: string;
  created_at: string;
  document_count: number;
  other_documents_preview: string;
  content_preview: string;
  current_document_anchor_role: ComparisonAnchorRole | null;
  current_document_sort_order: number | null;
};

/**
 * assistant 첨부·향후 툴에서 비교 상세 DTO 를 그대로 실을 때(선택).
 * `get_document_detail` 기본 경로에서는 생기지 않을 수 있음.
 */
export type AssistantComparisonDetailAttachment = {
  kind: "comparison_detail";
  context_document_id: string;
  data: ComparisonHistoryDetailPayload;
};
