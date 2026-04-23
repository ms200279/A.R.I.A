import "server-only";

import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

import { detectSensitiveContent } from "@/lib/safety/sensitive";

import { getSummaryMaxLengthForStore } from "./config";
import type { Summarizer, SummarizerInput, SummarizerOutput } from "./types";

/**
 * LLM 입력 상한(대략적 토큰 비용/지연 상한). 초과 시 잘라서 보낸다.
 * TODO: 문서/메일용으로는 별도 상한과 청크 요약을 도입.
 */
const MAX_USER_CONTENT_CHARS = 14_000;

const SYSTEM = `You are a concise text summarizer for a personal knowledge app.
- Output ONLY the summary text. No preface, no quotes, no markdown fences.
- Use the same primary language as the main content (Korean or English, etc.).
- Stay under 500 characters if possible. Be factual; do not invent details.
- If the content is empty or only whitespace, return a single line describing that there is no content.`;

/**
 * 민감 패턴 힌트는 **프롬프트에 보내지 않고** 메타데이터/로그용으로만 쓴다.
 * TODO: 정책에 따라 PII 감지 시 LLM 호출을 아예 막는 분기(현재는 메모 write 시점 policy 가 주도권).
 */
function truncateBody(content: string): { text: string; was_truncated: boolean } {
  if (content.length <= MAX_USER_CONTENT_CHARS) {
    return { text: content, was_truncated: false };
  }
  return {
    text: content.slice(0, MAX_USER_CONTENT_CHARS) + "\n…[truncated]",
    was_truncated: true,
  };
}

function buildUserPrompt(input: SummarizerInput, body: string): string {
  const titleLine = input.title?.trim() ? `Title: ${input.title.trim()}\n\n` : "";
  return `${titleLine}Content:\n${body}`;
}

function extractText(res: GenerateContentResponse): string {
  const t = res.text?.trim();
  if (t) return t;
  const c = res.candidates?.[0];
  const parts = c?.content?.parts ?? [];
  const chunks: string[] = [];
  for (const p of parts) {
    if (typeof p.text === "string" && p.text.length) chunks.push(p.text);
  }
  return chunks.join("\n").trim();
}

function clipSummary(text: string): string {
  const max = getSummaryMaxLengthForStore();
  const s = text.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function createGeminiSummarizer(opts: {
  apiKey: string;
  model: string;
}): Summarizer {
  return {
    id: "gemini",
    async summarize(input: SummarizerInput): Promise<SummarizerOutput> {
      const { text: userBody, was_truncated } = truncateBody(input.content);
      const sensitivity = detectSensitiveContent(userBody);
      const client = new GoogleGenAI({ apiKey: opts.apiKey });
      const userMessage = buildUserPrompt(input, userBody);

      const response: GenerateContentResponse = await client.models.generateContent(
        {
          model: opts.model,
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          config: {
            systemInstruction: SYSTEM,
            temperature: 0.2,
            maxOutputTokens: 600,
          },
        },
      );

      const raw = extractText(response);
      if (!raw) {
        throw new Error("empty_model_response");
      }
      const summary = clipSummary(raw);
      const usage = response.usageMetadata;
      return {
        summary,
        provider: "gemini",
        model: opts.model,
        strategy: "gemini",
        usage: {
          input_tokens: usage?.promptTokenCount,
          output_tokens: usage?.candidatesTokenCount,
          total_tokens: usage?.totalTokenCount,
        },
        metadata: {
          input_truncated: was_truncated,
          sensitivity_match_count: sensitivity.length,
          sensitivity_categories: sensitivity.map((m) => m.category),
        },
      };
    },
  };
}
