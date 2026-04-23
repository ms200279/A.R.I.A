import { Suspense } from "react";

import DoneClient from "./DoneClient";

/**
 * 콜백 성공 후 "완료" 전용 페이지.
 * - `useSearchParams` 는 반드시 Suspense 경계 아래에서 사용해야 하므로 서버 래퍼로 감싼다.
 * - 비즈니스 로직은 DoneClient 에만 둔다. 이 파일은 렌더 골격만 담당.
 */
export default function CallbackDonePage() {
  return (
    <Suspense fallback={<p className="text-sm opacity-75">처리 중...</p>}>
      <DoneClient />
    </Suspense>
  );
}
