import "server-only";

import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

import { getSummaryMaxLengthForStore, MAX_USER_CONTENT_CHARS } from "./config";
import { splitTextIntoSummarizeChunks } from "./chunking";
import type { SummarizerAdapter, SummarizerInput, SummarizerOutput } from "./types";

const SYSTEM_SINGLE = `You are a concise text summarizer for a personal knowledge app.
- Output ONLY the summary text. No preface, no quotes, no markdown fences.
- Use the same primary language as the main content (Korean or English, etc.).
- Stay under 500 characters if possible. Be factual; do not invent details.
- If the content is empty or only whitespace, return a single line describing that there is no content.`;

const SYSTEM_CHUNK = `You are summarizing one section of a longer text for a personal knowledge app.
- Output ONLY a short factual summary of THIS section. No preface or markdown.
- Same primary language as the section. Do not invent details.`;

const SYSTEM_MERGE = `You merge partial summaries into one concise summary for a personal knowledge app.
- Output ONLY the final summary text. No preface, no markdown fences.
- Same primary language as the partial summaries. Under 500 characters if possible. Be factual.`;

function buildUserPrompt(input: SummarizerInput, body: string): string {
  const titleLine = input.title?.trim() ? `Title: ${input.title.trim()}\n\n` : "";
  return `${titleLine}Content:\n${body}`;
}

function buildMergePrompt(
  input: SummarizerInput,
  partials: string[],
): string {
  const titleLine = input.title?.trim() ? `Title: ${input.title.trim()}\n\n` : "";
  const regen =
    input.regenerate === false || input.mode === "if_empty"
      ? ""
      : input.existingSummary?.trim()
        ? `\nPrevious summary (may be stale; improve if needed, do not quote verbatim):\n${input.existingSummary.trim().slice(0, 400)}\n`
        : "";
  const blocks = partials
    .map((p, i) => `--- Part ${i + 1} ---\n${p}`)
    .join("\n\n");
  return `${titleLine}${regen}Partial summaries:\n${blocks}`;
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

function addUsage(
  acc: NonNullable<SummarizerOutput["usage"]>,
  res: GenerateContentResponse,
): void {
  const u = res.usageMetadata;
  if (!u) return;
  acc.input_tokens = (acc.input_tokens ?? 0) + (u.promptTokenCount ?? 0);
  acc.output_tokens = (acc.output_tokens ?? 0) + (u.candidatesTokenCount ?? 0);
  acc.total_tokens = (acc.total_tokens ?? 0) + (u.totalTokenCount ?? 0);
}

export function createGeminiSummarizer(opts: {
  apiKey: string;
  model: string;
}): SummarizerAdapter {
  return {
    id: "gemini",
    async summarize(input: SummarizerInput): Promise<SummarizerOutput> {
      const client = new GoogleGenAI({ apiKey: opts.apiKey });
      const chunks = splitTextIntoSummarizeChunks(
        input.content ?? "",
        MAX_USER_CONTENT_CHARS,
      );
      const usage: NonNullable<SummarizerOutput["usage"]> = {};

      if (chunks.length <= 1) {
        const userMessage = buildUserPrompt(input, chunks[0] ?? "");
        const response: GenerateContentResponse = await client.models.generateContent(
          {
            model: opts.model,
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            config: {
              systemInstruction: SYSTEM_SINGLE,
              temperature: 0.2,
              maxOutputTokens: 600,
            },
          },
        );
        addUsage(usage, response);
        const raw = extractText(response);
        if (!raw) {
          throw new Error("empty_model_response");
        }
        return {
          summary: clipSummary(raw),
          provider: "gemini",
          model: opts.model,
          strategy: "gemini",
          chunked: false,
          usage,
          metadata: { chunking: "single" },
        };
      }

      const partials: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const chunkPrompt = `${buildUserPrompt(input, chunk)}\n\n(Section ${i + 1} of ${chunks.length})`;
        const response: GenerateContentResponse = await client.models.generateContent(
          {
            model: opts.model,
            contents: [{ role: "user", parts: [{ text: chunkPrompt }] }],
            config: {
              systemInstruction: SYSTEM_CHUNK,
              temperature: 0.2,
              maxOutputTokens: 400,
            },
          },
        );
        addUsage(usage, response);
        const part = extractText(response);
        if (!part) {
          throw new Error("empty_model_response_chunk");
        }
        partials.push(part);
      }

      const mergeMessage = buildMergePrompt(input, partials);
      const merged: GenerateContentResponse = await client.models.generateContent({
        model: opts.model,
        contents: [{ role: "user", parts: [{ text: mergeMessage }] }],
        config: {
          systemInstruction: SYSTEM_MERGE,
          temperature: 0.2,
          maxOutputTokens: 600,
        },
      });
      addUsage(usage, merged);
      const raw = extractText(merged);
      if (!raw) {
        throw new Error("empty_model_response_merge");
      }

      return {
        summary: clipSummary(raw),
        provider: "gemini",
        model: opts.model,
        strategy: "gemini",
        chunked: true,
        chunkCount: chunks.length,
        usage,
        metadata: {
          chunking: "chunk_and_merge",
          chunk_count: chunks.length,
        },
      };
    },
  };
}
