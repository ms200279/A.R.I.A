/**
 * 비교 히스토리 read-side DTO. API·RSC·assistant 인라인 카드가 동일 계약을 공유한다.
 * `comparison_history_documents.anchor_role` / sort_order·조인 기준( primary_document_id 단순 비교 아님 ).
 */

/**
 * DB `comparison_history_documents.anchor_role` check( primary | peer | secondary ).
 * `lib/documents/comparison-anchor-role` 정규화: 비정규·레거시는 null + dev 전용 경고.
 */
export type ComparisonAnchorRole = "primary" | "peer" | "secondary";

export type ComparisonHistoryCurrentContext = {
  document_id: string;
  anchor_role: ComparisonAnchorRole | null;
  sort_order: number | null;
};

/**
 * 비교 상세「포함 문서」read-side 정렬/필터( DTO 는 그대로, 화면만 가공).
 * @see lib/documents/comparison-detail-documents-view
 */
export type ComparisonDetailDocumentsSortMode =
  /** sort_order asc → tie-breaker 제목 */
  | "sort_order_default"
  | "title_asc"
  | "title_desc"
  | "role_priority";

export type ComparisonDetailDocumentsFilterMode =
  | "all"
  | "primary"
  | "peer"
  | "secondary"
  | "unknown";

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

/** `GET /api/comparisons/[id]` JSON — 상세 DTO + 북마크 여부. */
export type ComparisonHistoryDetailApiResponse = ComparisonHistoryDetailPayload & {
  is_bookmarked: boolean;
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
 * 비교 히스토리 목록 read-side. `ORDER BY created_at, id` 와 키셋 커서의 정렬 축.
 * (추가 정렬/anchor sort는 후속; TODO: 이 union 에만 키셋이 유효)
 */
export type ComparisonHistoryListSort = "created_at_desc" | "created_at_asc";

export type ComparisonHistoryListPageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type ComparisonHistoryListResult = {
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
  sort: ComparisonHistoryListSort;
};

/** `GET /api/documents/.../comparisons` · `GET /api/comparisons` 공통 응답(확장). */
export type ComparisonHistoryListApiResponse = {
  document_id?: string;
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
  sort: ComparisonHistoryListSort;
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
