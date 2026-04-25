/**
 * 문서 업로드 허용 형식·한도·검증의 단일 기준.
 * UI(`accept`·안내 문구)·클라이언트 선검증·서버 ingest(`validateDocumentUpload`)가 동일 소스를 쓴다.
 */

export const DOCUMENT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB

/** `<input accept>` 용 */
export const DOCUMENT_UPLOAD_ACCEPT_ATTR = ".txt,.md,.markdown,text/plain,text/markdown";

/** 사용자 안내(한국어). PDF 등 미지원은 과장하지 않는다. */
export const DOCUMENT_UPLOAD_DESCRIPTION_KO =
  "지원: .txt, .md, .markdown(또는 text/plain · text/markdown). 최대 5MB. PDF는 현재 지원하지 않습니다.";

const ALLOWED_MIME = new Set(["text/plain", "text/markdown"]);

export type UploadValidationResult =
  | { ok: true; normalized_mime: string }
  | { ok: false; reason: string };

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

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
