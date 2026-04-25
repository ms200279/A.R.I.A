import type {
  ComparisonHistoryListItemPayload,
  ComparisonHistoryListPageInfo,
} from "@/types/document";

import ComparisonHistoryLoadMore from "./ComparisonHistoryLoadMore";
import DocumentEmptyState from "./DocumentEmptyState";

type Props = {
  documentId: string;
  items: ComparisonHistoryListItemPayload[];
  pageInfo: ComparisonHistoryListPageInfo;
};

/**
 * 비교 이력: 첫 페이지는 서버에서 채우고, `hasMore` 이면 클라이언트에서 커서 로드.
 */
export default function DocumentComparisonHistorySection({ documentId, items, pageInfo }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-medium text-[var(--text-primary)]">
        이 문서가 포함된 비교 이력
      </h2>
      {items.length === 0 ? (
        <DocumentEmptyState
          title="아직 비교 이력이 없습니다"
          description="문서를 둘 이상 선택해 비교를 실행하면, 이 문서가 참여한 기록이 여기에 쌓입니다."
        />
      ) : (
        <ComparisonHistoryLoadMore
          documentId={documentId}
          initialItems={items}
          initialPageInfo={pageInfo}
        />
      )}
    </section>
  );
}
