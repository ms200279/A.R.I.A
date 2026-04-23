import "server-only";

import { getSummaryMaxLengthForStore } from "./config";
import type { Summarizer, SummarizerInput, SummarizerOutput } from "./types";

const SOFT_CAP = 280;

function buildRuleBasedSummary(title: string | null, content: string): string {
  const cleaned = (content ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return (title ?? "").trim();

  const sentences = cleaned
    .split(/(?<=[.!?。！？])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  let draft = "";
  for (const s of sentences) {
    const candidate = draft ? `${draft} ${s}` : s;
    if (candidate.length > SOFT_CAP) {
      if (!draft) {
        return cleaned.slice(0, SOFT_CAP - 1) + "…";
      }
      break;
    }
    draft = candidate;
    if (draft.length >= SOFT_CAP * 0.7 && sentences.indexOf(s) >= 1) {
      break;
    }
  }
  if (!draft) {
    return cleaned.slice(0, SOFT_CAP - 1) + "…";
  }
  return draft;
}

function clipForStorage(text: string): string {
  const max = getSummaryMaxLengthForStore();
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/**
 * 키 없이도 항상 동작하는 baseline. 민감정보 full 텍스트는 외부로 보내지 않는다.
 */
export function createRuleBasedV1Summarizer(): Summarizer {
  return {
    id: "rule_based_v1",
    async summarize(input: SummarizerInput): Promise<SummarizerOutput> {
      const raw = buildRuleBasedSummary(input.title, input.content);
      const summary = clipForStorage(raw);
      return {
        summary,
        provider: "rule",
        model: null,
        strategy: "rule_based_v1",
        metadata: { soft_char_cap: SOFT_CAP },
      };
    },
  };
}
