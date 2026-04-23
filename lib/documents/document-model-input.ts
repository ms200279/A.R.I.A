import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  prepareDocumentChunkTextForSummarize,
  prepareDocumentTextForSummarize,
} from "@/lib/safety/document-text";
import type { Document } from "@/types/document";

import { DOCUMENT_ROW_SELECT } from "./document-columns";

type ChunkRow = { chunk_index: number; content: string };

/**
 * summarize / compare / analyze 가 동일하게 쓰는 비신뢰 본문 합성.
 */
export function buildSanitizedDocumentInput(args: {
  chunks: ChunkRow[] | null;
  parsedText: string | null;
}): {
  text: string;
  source: "document_chunks" | "parsed_text";
  chunkRowCount: number | null;
} {
  if (args.chunks && args.chunks.length > 0) {
    const parts = args.chunks
      .slice()
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map((c) => prepareDocumentChunkTextForSummarize(c.content))
      .filter((p) => p.length > 0);
    return {
      text: parts.join("\n\n"),
      source: "document_chunks",
      chunkRowCount: args.chunks.length,
    };
  }
  return {
    text: prepareDocumentTextForSummarize(args.parsedText ?? ""),
    source: "parsed_text",
    chunkRowCount: null,
  };
}

/** summarize-document 와 동일한 “빈 본문” 분류. */
export function classifyDocumentUnusableForModel(doc: Document):
  | "document_empty"
  | "document_not_ready"
  | "document_not_summarizable" {
  if (
    doc.parsing_status === "unsupported_format" ||
    doc.parsing_status === "blocked" ||
    doc.parsing_status === "failed" ||
    doc.preprocessing_status === "blocked" ||
    doc.preprocessing_status === "failed" ||
    doc.status === "failed"
  ) {
    return "document_not_summarizable";
  }
  if (
    doc.status === "processing" ||
    doc.parsing_status !== "complete" ||
    doc.preprocessing_status !== "complete"
  ) {
    return "document_not_ready";
  }
  return "document_empty";
}

export type LoadedDocumentModelText =
  | {
      ok: true;
      document: Document;
      text: string;
      source: "document_chunks" | "parsed_text";
      chunk_row_count: number | null;
    }
  | { ok: false; reason: string };

/**
 * 단일 문서에 대해 청크(우선)·parsed_text 로 모델 입력용 정제 텍스트를 만든다.
 */
export async function loadSanitizedDocumentTextForModel(
  supabase: SupabaseClient,
  documentId: string,
): Promise<LoadedDocumentModelText> {
  const { data: doc, error: loadErr } = await supabase
    .from("documents")
    .select(DOCUMENT_ROW_SELECT)
    .eq("id", documentId)
    .maybeSingle();

  if (loadErr || !doc) {
    return { ok: false, reason: "document_not_found" };
  }

  const row = doc as Document;

  const { data: chunkRows, error: chunkErr } = await supabase
    .from("document_chunks")
    .select("chunk_index,content")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (chunkErr) {
    return { ok: false, reason: "document_chunks_load_failed" };
  }

  const built = buildSanitizedDocumentInput({
    chunks: (chunkRows as ChunkRow[] | null) ?? null,
    parsedText: row.parsed_text,
  });

  if (!built.text.trim()) {
    return { ok: false, reason: classifyDocumentUnusableForModel(row) };
  }

  return {
    ok: true,
    document: row,
    text: built.text,
    source: built.source,
    chunk_row_count: built.chunkRowCount,
  };
}
