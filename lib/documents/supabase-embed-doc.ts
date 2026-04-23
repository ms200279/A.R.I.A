/**
 * PostgREST 중첩 `documents(...)` 가 단건이어도 배열로 올 때가 있어 평준화한다.
 */
export function normalizeEmbeddedDocumentMeta(
  raw: unknown,
): { title: string | null; file_name: string | null } | null {
  if (raw == null) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const title = o.title === null || typeof o.title === "string" ? o.title : null;
  const file_name =
    o.file_name === null || typeof o.file_name === "string" ? o.file_name : null;
  return { title, file_name };
}
