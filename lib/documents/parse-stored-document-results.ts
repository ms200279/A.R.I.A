import type { DocumentAnalyzeResultPayload, DocumentCompareResultPayload } from "@/types/document";

/**
 * `document_summaries.content` 에 JSON 으로 저장된 비교 결과를 안전히 파싱한다.
 * 실패 시 null — 호출부에서 원문 문자열 폴백.
 */
export function tryParseCompareResult(content: string): DocumentCompareResultPayload | null {
  try {
    const o = JSON.parse(content) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (
      typeof r.summary_of_differences === "string" &&
      typeof r.summary_of_common_points === "string" &&
      typeof r.notable_gaps_or_conflicts === "string"
    ) {
      return {
        compared_document_ids: Array.isArray(r.compared_document_ids)
          ? (r.compared_document_ids as string[])
          : [],
        summary_of_differences: r.summary_of_differences,
        summary_of_common_points: r.summary_of_common_points,
        notable_gaps_or_conflicts: r.notable_gaps_or_conflicts,
      };
    }
  } catch {
    /* plain text or truncated json */
  }
  return null;
}

/**
 * 분석 결과 JSON (`analysis` 필수, `document_id` 권장).
 */
export function tryParseAnalysisResult(content: string): DocumentAnalyzeResultPayload | null {
  try {
    const o = JSON.parse(content) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (typeof r.analysis !== "string") return null;
    const document_id =
      typeof r.document_id === "string" ? r.document_id : "";
    return {
      document_id,
      analysis: r.analysis,
      key_points: Array.isArray(r.key_points) ? (r.key_points as string[]) : undefined,
      potential_risks: Array.isArray(r.potential_risks)
        ? (r.potential_risks as string[])
        : undefined,
      follow_up_questions: Array.isArray(r.follow_up_questions)
        ? (r.follow_up_questions as string[])
        : undefined,
    };
  } catch {
    return null;
  }
}
