import "server-only";

import type { ToolResult } from "../types";

/**
 * Provider-agnostic 도구 정의.
 *
 * 각 provider 어댑터가 자기 포맷으로 변환한다(OpenAI Responses API / Gemini functionDeclarations).
 * parameters 는 JSON Schema (Draft 2020-12 호환 서브셋) 를 그대로 쓴다.
 */
export type NeutralTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/**
 * Runner 가 provider 에 넘겨 주는 도구 실행 콜백.
 * provider 는 function call 이 나올 때마다 이 함수를 호출해 결과를 받는다.
 * 받은 결과는 provider 포맷으로 직렬화해서 모델에 되돌린다.
 */
export type ProviderToolExecutor = (
  name: string,
  args: unknown,
) => Promise<ToolResult>;

export type AssistantProviderRunInput = {
  systemPrompt: string;
  userMessage: string;
  tools: NeutralTool[];
  toolExecutor: ProviderToolExecutor;
  maxIterations: number;
};

export type AssistantProviderRunSuccess = {
  ok: true;
  finalText: string;
  iterations: number;
};

export type AssistantProviderRunFailure = {
  ok: false;
  error: "provider_error" | "iteration_limit" | "not_configured";
  message: string;
};

export type AssistantProviderRunResult =
  | AssistantProviderRunSuccess
  | AssistantProviderRunFailure;

export interface AssistantProvider {
  readonly name: "gemini" | "openai";
  readonly model: string;
  run(input: AssistantProviderRunInput): Promise<AssistantProviderRunResult>;
}
