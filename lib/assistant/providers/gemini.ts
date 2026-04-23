import "server-only";

import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";

import type {
  AssistantProvider,
  AssistantProviderRunInput,
  AssistantProviderRunResult,
  NeutralTool,
} from "./types";

/**
 * Google Gemini (@google/genai) 기반 provider.
 *
 * 책임:
 *  - neutral tool 정의를 Gemini functionDeclarations 로 변환 (parametersJsonSchema 사용)
 *  - contents[] 배열을 직접 관리하며 모델 응답에 functionCall 이 나올 때마다 실행 후
 *    functionResponse 파트를 user-role content 로 append 해 재호출
 *  - 루프 종료 후 최종 text 를 반환
 *
 * 참고:
 *  - Gemini SDK 는 응답에서 role 이 "model" 인 Content 를 돌려주고,
 *    function response 는 role "user" 의 Content 에 functionResponse part 로 넣는다.
 *  - SYSTEM_PROMPT 는 config.systemInstruction 으로 전달한다 (history 에 섞지 않는다).
 */

export class GeminiProvider implements AssistantProvider {
  readonly name = "gemini" as const;
  readonly model: string;

  private client: GoogleGenAI | null = null;
  private readonly apiKey: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
  }

  private getClient(): GoogleGenAI {
    if (!this.client) this.client = new GoogleGenAI({ apiKey: this.apiKey });
    return this.client;
  }

  async run(input: AssistantProviderRunInput): Promise<AssistantProviderRunResult> {
    const { systemPrompt, userMessage, tools, toolExecutor, maxIterations } = input;

    const functionDeclarations: FunctionDeclaration[] = tools.map(toFunctionDeclaration);

    const contents: Content[] = [
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const config = {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      },
    };

    let iterations = 0;
    for (let step = 0; step < maxIterations; step += 1) {
      iterations += 1;

      let response: GenerateContentResponse;
      try {
        response = await this.getClient().models.generateContent({
          model: this.model,
          contents,
          config,
        });
      } catch (err) {
        return {
          ok: false,
          error: "provider_error",
          message: err instanceof Error ? err.message : String(err),
        };
      }

      const candidate = response.candidates?.[0];
      const modelParts: Part[] = candidate?.content?.parts ?? [];

      // Gemini 는 functionCalls() getter 가 있다. 없으면 수동 수집.
      const fnCalls: FunctionCall[] = response.functionCalls ?? collectFunctionCalls(modelParts);

      if (fnCalls.length === 0) {
        // 최종 응답. text getter 는 thought/inline 을 제외한 text 만 이어 붙인다.
        const finalText = response.text ?? extractTextFromParts(modelParts);
        return { ok: true, finalText: finalText.trim(), iterations };
      }

      // 모델 턴을 history 에 추가
      if (modelParts.length > 0) {
        contents.push({ role: "model", parts: modelParts });
      }

      // 각 function call 실행 후 functionResponse 파트들로 다음 turn 구성
      const responseParts: Part[] = [];
      for (const call of fnCalls) {
        const name = call.name ?? "";
        const args = call.args ?? {};
        const result = await toolExecutor(name, args);
        responseParts.push({
          functionResponse: {
            name,
            response: { result },
          },
        });
      }
      contents.push({ role: "user", parts: responseParts });

      if (step === maxIterations - 1) {
        // 한 번 더 호출해서 텍스트 응답을 끌어내고 싶지만, 루프 예산이 끝났으므로 종료.
        return {
          ok: false,
          error: "iteration_limit",
          message: `exceeded ${maxIterations} iterations`,
        };
      }
    }

    return {
      ok: false,
      error: "iteration_limit",
      message: `exceeded ${maxIterations} iterations`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function toFunctionDeclaration(tool: NeutralTool): FunctionDeclaration {
  // parametersJsonSchema 를 쓰면 JSON Schema 를 그대로 전달할 수 있다.
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parameters,
  };
}

function collectFunctionCalls(parts: Part[]): FunctionCall[] {
  const out: FunctionCall[] = [];
  for (const p of parts) {
    if (p.functionCall) out.push(p.functionCall);
  }
  return out;
}

function extractTextFromParts(parts: Part[]): string {
  const chunks: string[] = [];
  for (const p of parts) {
    if (typeof p.text === "string" && p.text.length > 0) chunks.push(p.text);
  }
  return chunks.join("\n");
}
