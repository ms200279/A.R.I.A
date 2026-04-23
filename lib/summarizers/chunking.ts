import "server-only";

/**
 * 긴 본문을 요약용 청크로 나눈다. 단일 청크면 상위에서 바로 1-pass 요약하면 된다.
 */

function lastBreakIndex(slice: string): number {
  const doubleNl = slice.lastIndexOf("\n\n");
  if (doubleNl > 0) return doubleNl + 2;
  const nl = slice.lastIndexOf("\n");
  if (nl > 0) return nl + 1;
  const sentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("。 "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentence > 0) return sentence + 2;
  return slice.length;
}

/**
 * `maxChunkChars` 를 넘지 않도록, 가능하면 문단/줄/문장 경계에서 자른다.
 */
export function splitTextIntoSummarizeChunks(
  text: string,
  maxChunkChars: number,
): string[] {
  const t = text ?? "";
  if (!t || t.length <= maxChunkChars) {
    return [t];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    const hardEnd = Math.min(start + maxChunkChars, t.length);
    if (hardEnd >= t.length) {
      chunks.push(t.slice(start));
      break;
    }
    const slice = t.slice(start, hardEnd);
    let br = lastBreakIndex(slice);
    if (br < Math.floor(maxChunkChars * 0.35)) {
      br = maxChunkChars;
    }
    const end = start + br;
    chunks.push(t.slice(start, end));
    start = end;
  }
  return chunks;
}
