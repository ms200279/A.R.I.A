import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ingestUploadedDocument } from "@/lib/documents/ingest-upload";

export const dynamic = "force-dynamic";

const REASON_TO_STATUS: Record<string, number> = {
  missing_file_name: 400,
  empty_file: 400,
  file_too_large: 413,
  unsupported_file_type: 415,
  unsupported_format: 415,
  empty_text: 422,
  decode_error: 422,
  empty_after_preprocess: 422,
  size_mismatch: 400,
  document_row_insert_failed: 500,
  storage_upload_failed: 502,
  chunk_insert_failed: 500,
};

/**
 * POST /api/documents/upload
 *
 * multipart/form-data:
 *   - `file` (required): 업로드 파일
 *   - `title` (optional): 표시 제목
 *
 * Storage → documents → 파싱 → document_chunks 까지 동기 처리한다.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const titleRaw = form.get("title");
  const title =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;

  const result = await ingestUploadedDocument(file, {
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
  }, { title });

  if (result.status === "error") {
    const status = REASON_TO_STATUS[result.reason] ?? 500;
    return NextResponse.json(
      {
        error: result.reason,
        document_id: result.document_id ?? null,
      },
      { status },
    );
  }

  return NextResponse.json({ document: result.document }, { status: 201 });
}
