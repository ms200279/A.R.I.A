/**
 * 문서 요약 파이프라인용 본문 상한.
 * 메모(50k)보다 크게 잡되, 서버 메모리·rule fallback 비용을 고려해 상한을 둔다.
 * (Gemini 경로는 `MAX_USER_CONTENT_CHARS` 단위로 내부 청크 분할.)
 */

export const DOCUMENT_SUMMARIZE_INPUT_MAX_CHARS = 300_000;
