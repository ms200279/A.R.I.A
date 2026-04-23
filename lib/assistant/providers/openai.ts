import "server-only";

import OpenAI from "openai";
import type {
  Response as OpenAIResponse,
  ResponseFunctionToolCall,
  ResponseInputItem,
  Tool as OpenAITool,
} from "openai/resources/responses/responses";

import type {
  AssistantProvider,
  AssistantProviderRunInput,
  AssistantProviderRunResult,
  NeutralTool,
} from "./types";

/**
 * OpenAI Responses API 기반 provider.
 *
 * 책임:
 *  - neutral tool 정의를 OpenAI function tool 포맷으로 변환
 *  - Responses API 호출 루프를 돌리며 function_call → function_call_output 재주입
 *  - 루프 종료 후 최종 output_text 를 반환
 *
 * 이 파일은 `client.ts` 의 OpenAI 게터를 쓰지 않고 provider 내부에서 직접 인스턴스화한다.
 * client.ts 는 다른 도메인(assistant runner)이 provider 선택에 의존하지 않도록
 * 환경변수 헬퍼만 제공한다.
 */

export class OpenAIProvider implements AssistantProvider {
  readonly name = "openai" as const;
  readonly model: string;

  private client: OpenAI | null = null;
  private readonly apiKey: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
  }

  private getClient(): OpenAI {
    if (!this.client) this.client = new OpenAI({ apiKey: this.apiKey });
    return this.client;
  }

  async run(input: AssistantProviderRunInput): Promise<AssistantProviderRunResult> {
    const { systemPrompt, userMessage, tools, toolExecutor, maxIterations } = input;
    const client = this.getClient();
    const openaiTools = tools.map(toOpenAIToolDef);

    let current: OpenAIResponse;
    try {
      current = await client.responses.create({
        model: this.model,
        input: [
          { role: "developer", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: openaiTools,
      });
    } catch (err) {
      return {
        ok: false,
        error: "provider_error",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    let iterations = 1;
    for (let step = 0; step < maxIterations; step += 1) {
      const calls = extractFunctionCalls(current);
      if (calls.length === 0) break;

      const outputItems: ResponseInputItem[] = [];
      for (const call of calls) {
        const args = safeParseJSONArgs(call.arguments);
        const result = await toolExecutor(call.name, args);
        outputItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }

      try {
        current = await client.responses.create({
          model: this.model,
          previous_response_id: current.id,
          input: outputItems,
          tools: openaiTools,
        });
      } catch (err) {
        return {
          ok: false,
          error: "provider_error",
          message: err instanceof Error ? err.message : String(err),
        };
      }
      iterations += 1;

      if (step === maxIterations - 1 && extractFunctionCalls(current).length > 0) {
        return {
          ok: false,
          error: "iteration_limit",
          message: `exceeded ${maxIterations} iterations`,
        };
      }
    }

    return {
      ok: true,
      finalText: extractFinalText(current),
      iterations,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function toOpenAIToolDef(tool: NeutralTool): OpenAITool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    // 현재 스키마는 합리적 optional 필드가 섞여 있어 strict:false 로 둔다.
    strict: false,
    parameters: tool.parameters,
  };
}

function extractFunctionCalls(resp: OpenAIResponse): ResponseFunctionToolCall[] {
  const out: ResponseFunctionToolCall[] = [];
  for (const item of resp.output) {
    if (item.type === "function_call") out.push(item);
  }
  return out;
}

function extractFinalText(resp: OpenAIResponse): string {
  if (typeof resp.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text;
  }
  const parts: string[] = [];
  for (const item of resp.output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c.type === "output_text" && typeof c.text === "string") {
          parts.push(c.text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

function safeParseJSONArgs(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
