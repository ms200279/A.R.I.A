import "server-only";

import type { PendingActionResult } from "@/types/pending-action";

export function isMemoSavedPendingResult(
  r: unknown,
): r is Extract<PendingActionResult, { kind: "memo_saved" }> {
  return (
    typeof r === "object" &&
    r !== null &&
    (r as { kind?: string }).kind === "memo_saved" &&
    typeof (r as { memo_id?: string }).memo_id === "string"
  );
}
