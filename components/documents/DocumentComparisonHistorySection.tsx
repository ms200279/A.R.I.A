import type { ComparisonHistoryListItemPayload } from "@/types/document";

import DocumentComparisonHistoryItem from "./DocumentComparisonHistoryItem";
import DocumentEmptyState from "./DocumentEmptyState";

type Props = {
  documentId: string;
  items: ComparisonHistoryListItemPayload[];
};

export default function DocumentComparisonHistorySection({ documentId, items }: Props) {
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
        <ul className="space-y-3">
          {items.map((item) => (
            <DocumentComparisonHistoryItem
              key={item.comparison_id}
              item={item}
              contextDocumentId={documentId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
