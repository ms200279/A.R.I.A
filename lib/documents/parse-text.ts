import "server-only";

export type ParseTextOutcome =
  | { kind: "ok"; text: string }
  | { kind: "unsupported_format"; mime: string; hint: string }
  | { kind: "empty" }
  | { kind: "decode_error" };

/**
 * PDF 등 바이너리 추출은 전용 패키지가 필요하므로 이번 단계에서는 명시적으로 차단한다.
 * txt / md 만 UTF-8 로 디코드한다.
 */
export function parseDocumentBufferToText(
  buffer: Buffer,
  normalizedMime: string,
): ParseTextOutcome {
  if (normalizedMime === "application/pdf") {
    return {
      kind: "unsupported_format",
      mime: normalizedMime,
      hint: "pdf_parser_not_enabled",
    };
  }

  if (normalizedMime !== "text/plain" && normalizedMime !== "text/markdown") {
    return {
      kind: "unsupported_format",
      mime: normalizedMime,
      hint: "mime_not_supported",
    };
  }

  try {
    const raw = buffer.toString("utf8");
    const text = raw.replace(/^\uFEFF/, "").replace(/\0/g, "");
    if (!text.trim()) {
      return { kind: "empty" };
    }
    return { kind: "ok", text };
  } catch {
    return { kind: "decode_error" };
  }
}
