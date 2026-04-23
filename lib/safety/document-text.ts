/**
 * 문서(비신뢰) 텍스트를 요약 파이프라인에 넣기 전 최소 전처리.
 * - 원문 전체를 "지시문" 슬롯에 싣지 않는 것은 호출부(데이터 슬롯·chunk) 책임.
 * - 여기서는 제어문자 제거·정규화만 수행한다.
 */

export function prepareDocumentTextForSummarize(raw: string): string {
  let s = raw.replace(/\0/g, "");
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  s = s.replace(/\n{5,}/g, "\n\n\n\n");
  return s.trim();
}

/**
 * 청크 단위로 호출해 조인 전 정규화할 때 사용.
 */
export function prepareDocumentChunkTextForSummarize(chunk: string): string {
  return prepareDocumentTextForSummarize(chunk);
}
