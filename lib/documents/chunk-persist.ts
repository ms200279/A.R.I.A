import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { prepareDocumentTextForSummarize } from "@/lib/safety/document-text";
import { splitTextIntoSummarizeChunks } from "@/lib/summarizers/chunking";

/** summarizer 청크 상한과 맞춰 검색·요약 입력을 재사용한다. */
import { MAX_USER_CONTENT_CHARS } from "@/lib/summarizers/config";

/**
 * DB/메모리 보호: 파싱 결과 전체를 documents.parsed_text 에 넣을 상한.
 * (원본은 Storage 에 보존)
 */
export const PARSED_TEXT_STORE_MAX_CHARS = 300_000;

export type BuildChunksResult =
  | {
      ok: true;
      parsedTextStored: string;
      truncated: boolean;
      chunkCount: number;
    }
  | { ok: false; reason: "empty_after_preprocess" | "chunk_insert_failed" };

function approxTokenCount(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

/**
 * 비신뢰 텍스트 전처리 → 청크 분할 → `document_chunks` 일괄 insert.
 */
export async function preprocessAndInsertChunks(args: {
  service: SupabaseClient;
  documentId: string;
  userId: string;
  rawParsedText: string;
}): Promise<BuildChunksResult> {
  const sanitized = prepareDocumentTextForSummarize(args.rawParsedText);
  if (!sanitized.trim()) {
    return { ok: false, reason: "empty_after_preprocess" };
  }

  let truncated = false;
  let toStore = sanitized;
  if (toStore.length > PARSED_TEXT_STORE_MAX_CHARS) {
    toStore = toStore.slice(0, PARSED_TEXT_STORE_MAX_CHARS);
    truncated = true;
  }

  const pieces = splitTextIntoSummarizeChunks(toStore, MAX_USER_CONTENT_CHARS)
    .map((c) => prepareDocumentTextForSummarize(c))
    .filter((c) => c.trim().length > 0);

  if (pieces.length === 0) {
    return { ok: false, reason: "empty_after_preprocess" };
  }

  const rows = pieces.map((content, chunk_index) => ({
    document_id: args.documentId,
    user_id: args.userId,
    chunk_index,
    content,
    token_count: approxTokenCount(content),
    page_number: null as number | null,
    section_label: null as string | null,
  }));

  const { error } = await args.service.from("document_chunks").insert(rows);
  if (error) {
    return { ok: false, reason: "chunk_insert_failed" };
  }

  return {
    ok: true,
    parsedTextStored: toStore,
    truncated,
    chunkCount: pieces.length,
  };
}
