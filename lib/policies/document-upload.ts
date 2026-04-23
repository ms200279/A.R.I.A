/**
 * 문서 업로드 게이트(크기·MIME·확장자).
 * 원문 내용 검사는 파싱 후 `lib/safety/document-text` 등에서 수행한다.
 */

export const DOCUMENT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB (Route/호스팅 한도 고려)

const ALLOWED_MIME = new Set(["text/plain", "text/markdown"]);

export type UploadValidationResult =
  | { ok: true; normalized_mime: string }
  | { ok: false; reason: string };

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** PDF 는 별도 파서 패키지 없이는 처리하지 않는다. */
function isExplicitlyUnsupported(ext: string, mime: string): boolean {
  return (
    ext === ".pdf" ||
    mime === "application/pdf" ||
    mime === "application/x-pdf"
  );
}

/**
 * 브라우저가 application/octet-stream 등을 줄 수 있으므로 확장자로 보강한다.
 */
export function validateDocumentUpload(args: {
  fileName: string;
  declaredMime: string;
  sizeBytes: number;
}): UploadValidationResult {
  if (!args.fileName?.trim()) {
    return { ok: false, reason: "missing_file_name" };
  }
  if (!Number.isFinite(args.sizeBytes) || args.sizeBytes <= 0) {
    return { ok: false, reason: "empty_file" };
  }
  if (args.sizeBytes > DOCUMENT_UPLOAD_MAX_BYTES) {
    return { ok: false, reason: "file_too_large" };
  }

  const ext = extOf(args.fileName);
  const mime = (args.declaredMime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";

  if (isExplicitlyUnsupported(ext, mime)) {
    return { ok: false, reason: "unsupported_file_type" };
  }

  if (ext === ".md" || ext === ".markdown") {
    return { ok: true, normalized_mime: "text/markdown" };
  }
  if (ext === ".txt") {
    return { ok: true, normalized_mime: "text/plain" };
  }

  if (ALLOWED_MIME.has(mime)) {
    return { ok: true, normalized_mime: mime };
  }

  return { ok: false, reason: "unsupported_file_type" };
}
