"use client";

/** 브라우저에서 파일 내용 SHA-256 (hex). 업로드 정책 최대 크기 내에서만 호출한다. */
export async function computeFileSha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
