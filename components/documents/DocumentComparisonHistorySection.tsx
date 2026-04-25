import type {
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListPageInfo,
  ComparisonHistoryListRoleFilter,
  ComparisonHistoryListSort,
} from "@/types/document";

import ComparisonHistoryListWithControls from "./ComparisonHistoryListWithControls";

type Props = {
  documentId: string;
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
  initialSort: ComparisonHistoryListSort;
  initialRoleFilter: ComparisonHistoryListRoleFilter;
};

/**
 * 비교 이력: 첫 페이지는 RSC, 이후는 `ComparisonHistoryListWithControls` 에서 정렬·필터·커서 로드.
 */
export default function DocumentComparisonHistorySection({
  documentId,
  items,
  pageInfo,
  initialSort,
  initialRoleFilter,
}: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-medium text-[var(--text-primary)]">
        이 문서가 포함된 비교 이력
      </h2>
      <ComparisonHistoryListWithControls
        documentId={documentId}
        items={items}
        pageInfo={pageInfo}
        initialSort={initialSort}
        initialRoleFilter={initialRoleFilter}
      />
    </section>
  );
}
