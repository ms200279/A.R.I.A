import "server-only";

const BUCKET = "documents";

/**
 * Storage object path: `{user_id}/{document_id}/{safe_file_name}`
 * — 첫 세그먼트가 user_id 이므로 storage RLS 와 정합.
 */
export function buildDocumentStoragePath(args: {
  userId: string;
  documentId: string;
  fileName: string;
}): { bucket: string; path: string } {
  return {
    bucket: BUCKET,
    path: `${args.userId}/${args.documentId}/${safeFileSegment(args.fileName)}`,
  };
}

export function getDocumentsBucket(): string {
  return BUCKET;
}

/** 경로 공격·너무 긴 이름 완화. */
export function safeFileSegment(original: string): string {
  const base = original
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .trim()
    .slice(0, 180);
  return base.length > 0 ? base : "upload.txt";
}
