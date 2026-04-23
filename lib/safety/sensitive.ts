/**
 * 민감정보 최소 탐지.
 *
 * 여기서는 "메모 저장 시 사용자에게 한 번 더 경고"하는 용도로만 쓴다.
 * 정교한 PII 분류 시스템을 만들지 않는다 (과도한 탐지 금지).
 * 필요 시 detectSensitiveContent 를 block 판정으로 승격시킬 수 있도록
 * 결과 타입에 category / severity 만 남겨 둔다.
 */

export type SensitivityCategory =
  | "korean_ssn"
  | "credit_card"
  | "phone_kr"
  | "api_key_like";

export type SensitivityMatch = {
  category: SensitivityCategory;
};

const PATTERNS: Record<SensitivityCategory, RegExp> = {
  korean_ssn: /\b\d{6}-\d{7}\b/,
  credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  phone_kr: /(?:^|\D)01\d[-\s]?\d{3,4}[-\s]?\d{4}(?:\D|$)/,
  api_key_like: /(?:sk|pk|api[_-]?key|secret|token)[-_a-z0-9]{0,16}[=:]\s*[A-Za-z0-9_\-]{16,}/i,
};

export function detectSensitiveContent(text: string): SensitivityMatch[] {
  if (!text) return [];
  const matches: SensitivityMatch[] = [];
  for (const category of Object.keys(PATTERNS) as SensitivityCategory[]) {
    if (PATTERNS[category].test(text)) {
      matches.push({ category });
    }
  }
  return matches;
}

export function hasSensitiveContent(text: string): boolean {
  return detectSensitiveContent(text).length > 0;
}
