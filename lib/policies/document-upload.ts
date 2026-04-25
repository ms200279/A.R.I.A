/**
 * @deprecated 직접 import 대신 `@/lib/documents/supported-file-types` 를 권장.
 * ingest 등 기존 경로 호환용 re-export.
 */

export {
  DOCUMENT_UPLOAD_ACCEPT_ATTR,
  DOCUMENT_UPLOAD_DESCRIPTION_KO,
  DOCUMENT_UPLOAD_MAX_BYTES,
  validateDocumentUpload,
  type UploadValidationResult,
} from "@/lib/documents/supported-file-types";
