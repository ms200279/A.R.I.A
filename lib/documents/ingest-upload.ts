import "server-only";

import { createHash } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";
import {
  logDocumentUploadCompleted,
  logDocumentUploadFailed,
  logDocumentUploadParsingCompleted,
  logDocumentUploadParsingFailed,
  logDocumentUploadParsingStarted,
  logDocumentUploadPreprocessingBlocked,
  logDocumentUploadRowCreated,
  logDocumentUploadStarted,
  logDocumentUploadStorageFailed,
  logDocumentUploadStorageSucceeded,
} from "@/lib/logging/audit-log";
import { validateDocumentUpload } from "@/lib/documents/supported-file-types";
import type { Document } from "@/types/document";

import { DOCUMENT_ROW_SELECT } from "./document-columns";
import { preprocessAndInsertChunks } from "./chunk-persist";
import { parseDocumentBufferToText } from "./parse-text";
import { buildDocumentStoragePath, safeFileSegment } from "./storage-path";

export type IngestUploadContext = {
  user_id: string;
  user_email?: string | null;
};

export type IngestUploadResult =
  | { status: "ok"; document: Document }
  | { status: "error"; reason: string; document_id?: string };

/**
 * multipart 로 받은 파일을 Storage + documents + document_chunks 까지 처리한다.
 * summarize 는 호출하지 않는다.
 */
export async function ingestUploadedDocument(
  file: File,
  ctx: IngestUploadContext,
  options: { title?: string | null } = {},
): Promise<IngestUploadResult> {
  const declaredMime = file.type ?? "";
  const gate = validateDocumentUpload({
    fileName: file.name,
    declaredMime,
    sizeBytes: file.size,
  });

  if (!gate.ok) {
    await logDocumentUploadFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: null,
      reason: gate.reason,
    });
    return { status: "error", reason: gate.reason };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length !== file.size) {
    return { status: "error", reason: "size_mismatch" };
  }

  const hash = createHash("sha256").update(buf).digest("hex");
  const safeName = safeFileSegment(file.name);
  const title =
    (options.title ?? "").trim() ||
    file.name.replace(/\.[^/.]+$/, "").trim() ||
    safeName;

  await logDocumentUploadStarted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    file_name: file.name,
    file_size: buf.length,
    declared_mime: declaredMime,
  });

  const service = createServiceClient();

  const { data: created, error: createErr } = await service
    .from("documents")
    .insert({
      user_id: ctx.user_id,
      title,
      file_name: file.name,
      file_type: gate.normalized_mime,
      mime_type: gate.normalized_mime,
      file_size: buf.length,
      sha256_hash: hash,
      storage_path: null,
      parsed_text: null,
      status: "processing",
      parsing_status: "pending",
      preprocessing_status: "pending",
      summary_status: "none",
      parsing_error_code: null,
    })
    .select(DOCUMENT_ROW_SELECT)
    .single();

  if (createErr || !created) {
    await logDocumentUploadFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      reason: "document_row_insert_failed",
    });
    return { status: "error", reason: "document_row_insert_failed" };
  }

  const doc = created as Document;
  const docId = doc.id;

  await logDocumentUploadRowCreated({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: docId,
    sha256_prefix: hash.slice(0, 12),
  });

  const { bucket, path: storagePath } = buildDocumentStoragePath({
    userId: ctx.user_id,
    documentId: docId,
    fileName: safeName,
  });

  const { error: upErr } = await service.storage
    .from(bucket)
    .upload(storagePath, buf, {
      contentType: gate.normalized_mime,
      upsert: false,
    });

  if (upErr) {
    await logDocumentUploadStorageFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: docId,
      storage_path: storagePath,
      error_message: upErr.message?.slice(0, 200) ?? null,
    });
    await service.from("documents").delete().eq("id", docId).eq("user_id", ctx.user_id);
    await logDocumentUploadFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: docId,
      reason: "storage_upload_failed",
    });
    return { status: "error", reason: "storage_upload_failed", document_id: docId };
  }

  await service
    .from("documents")
    .update({ storage_path: storagePath })
    .eq("id", docId)
    .eq("user_id", ctx.user_id);

  await logDocumentUploadStorageSucceeded({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: docId,
    storage_path: storagePath,
  });

  await service
    .from("documents")
    .update({ parsing_status: "in_progress" })
    .eq("id", docId)
    .eq("user_id", ctx.user_id);

  await logDocumentUploadParsingStarted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: docId,
  });

  const parsed = parseDocumentBufferToText(buf, gate.normalized_mime);

  if (parsed.kind === "unsupported_format") {
    await service
      .from("documents")
      .update({
        parsing_status: "unsupported_format",
        preprocessing_status: "failed",
        status: "failed",
        parsing_error_code: parsed.hint,
      })
      .eq("id", docId)
      .eq("user_id", ctx.user_id);
    await logDocumentUploadParsingFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: docId,
      outcome: "unsupported_format",
      error_code: parsed.hint,
    });
    return {
      status: "error",
      reason: "unsupported_format",
      document_id: docId,
    };
  }

  if (parsed.kind === "empty" || parsed.kind === "decode_error") {
    const code = parsed.kind === "empty" ? "empty_text" : "decode_error";
    await service
      .from("documents")
      .update({
        parsing_status: "failed",
        preprocessing_status: "failed",
        status: "failed",
        parsing_error_code: code,
      })
      .eq("id", docId)
      .eq("user_id", ctx.user_id);
    await logDocumentUploadParsingFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: docId,
      outcome: parsed.kind,
      error_code: code,
    });
    return { status: "error", reason: code, document_id: docId };
  }

  await logDocumentUploadParsingCompleted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: docId,
    outcome: "text_extracted",
    error_code: null,
  });

  await service
    .from("documents")
    .update({
      parsing_status: "complete",
      preprocessing_status: "in_progress",
    })
    .eq("id", docId)
    .eq("user_id", ctx.user_id);

  const chunkResult = await preprocessAndInsertChunks({
    service,
    documentId: docId,
    userId: ctx.user_id,
    rawParsedText: parsed.text,
  });

  if (!chunkResult.ok) {
    if (chunkResult.reason === "empty_after_preprocess") {
      await logDocumentUploadPreprocessingBlocked({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        document_id: docId,
        reason: chunkResult.reason,
      });
    }
    await service
      .from("documents")
      .update({
        preprocessing_status:
          chunkResult.reason === "empty_after_preprocess" ? "blocked" : "failed",
        status: "failed",
        parsing_error_code: chunkResult.reason,
      })
      .eq("id", docId)
      .eq("user_id", ctx.user_id);
    await logDocumentUploadFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      document_id: docId,
      reason: chunkResult.reason,
    });
    return { status: "error", reason: chunkResult.reason, document_id: docId };
  }

  await service
    .from("documents")
    .update({
      parsed_text: chunkResult.parsedTextStored,
      preprocessing_status: "complete",
      status: "active",
      summary_status: "none",
    })
    .eq("id", docId)
    .eq("user_id", ctx.user_id);

  await logDocumentUploadCompleted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    document_id: docId,
    chunk_count: chunkResult.chunkCount,
    parsed_text_truncated: chunkResult.truncated,
  });

  const { data: finalRow } = await service
    .from("documents")
    .select(DOCUMENT_ROW_SELECT)
    .eq("id", docId)
    .eq("user_id", ctx.user_id)
    .single();

  return {
    status: "ok",
    document: (finalRow ?? created) as Document,
  };
}
