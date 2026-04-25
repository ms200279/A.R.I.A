import { MEMO_TAGS_MAX_COUNT, MEMO_TAG_MAX_CHARS } from "@/types/memos";

/**
 * 콤마( , / ，) 구분 입력 → 정규화된 태그 배열. UI·API 공용.
 */
export function parseMemoTagsFromInput(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  const parts = s.split(/[,，]/u);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim().slice(0, MEMO_TAG_MAX_CHARS);
    if (!t) continue;
    if (out.length >= MEMO_TAGS_MAX_COUNT) break;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 저장/승인 payload 용: 이미 배열로 온 값을 한 번 더 정리한다. */
export function normalizeMemoTagList(input: string[] | undefined | null): string[] {
  if (!input?.length) return [];
  return parseMemoTagsFromInput(input.join(","));
}
