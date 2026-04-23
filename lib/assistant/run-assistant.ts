import "server-only";

import type {
  Response as OpenAIResponse,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";

import {
  logAssistantRequestReceived,
  logAssistantRunCompleted,
  logAssistantRunFailed,
} from "@/lib/logging/audit-log";

import { getOpenAI, resolveMaxIterations, resolveModelName } from "./client";
import { executeTool } from "./execute-tool";
import { mapAssistantAnswer } from "./response-mapper";
import { SYSTEM_PROMPT } from "./system-prompt";
import { TOOL_DEFS, TOOL_TIERS, type ToolName } from "./tools";
import type {
  AssistantRunContext,
  RunAssistantFailure,
  RunAssistantResult,
  ToolCallTrace,
  ToolResult,
} from "./types";

export type RunAssistantInput = {
  userMessage: string;
  ctx: AssistantRunContext;
};

export type RunAssistantOutput =
  | { ok: true; data: RunAssistantResult }
  | { ok: false; failure: RunAssistantFailure };

/**
 * Assistant 실행 루프.
 *
 * 흐름:
 *   1. developer(system) + user 메시지로 Responses API 호출.
 *   2. response.output 에서 function_call 을 뽑아 각 도구를 서버 측에서 실행.
 *   3. function_call_output 들을 previous_response_id 와 함께 재주입.
 *   4. 도구 호출이 더 이상 없을 때 최종 텍스트를 확보하고 매핑.
 *
 * 안전장치:
 *   - MAX_ITERATIONS 루프 상한(기본 5). 초과 시 iteration_limit 실패로 종료.
 *   - 도구 호출은 executeTool 이 티어/스키마/정책을 모두 검증한다.
 *   - 에러가 루프를 타고 올라가도 호출부(Route Handler)가 JSON 으로 감쌀 수 있도록
 *     run-assistant 자체는 throw 하지 않고 `{ ok: false, failure }` 로 반환한다.
 */
export async function runAssistant(
  input: RunAssistantInput,
): Promise<RunAssistantOutput> {
  const { userMessage, ctx } = input;
  const model = resolveModelName();
  const maxIterations = resolveMaxIterations();

  await logAssistantRequestReceived({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    session_id: ctx.session_id ?? null,
    message_length: userMessage.length,
  });

  const client = safeGetClient();
  if (!client.ok) return client;

  let current: OpenAIResponse;
  try {
    current = await client.value.responses.create({
      model,
      input: [
        { role: "developer", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      tools: TOOL_DEFS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAssistantRunFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      session_id: ctx.session_id ?? null,
      error_code: "openai_failed",
      error_message: message,
    });
    return { ok: false, failure: { error: "openai_failed", message } };
  }

  const toolTrace: ToolCallTrace[] = [];
  const pendingActionIds: string[] = [];

  let iterations = 1;
  for (let step = 0; step < maxIterations; step += 1) {
    const calls = extractFunctionCalls(current);
    if (calls.length === 0) break;

    const outputItems: ResponseInputItem[] = [];
    for (const call of calls) {
      const args = safeParseJSONArgs(call.arguments);
      const result = await executeTool(call.name, args, ctx);
      trackTrace(toolTrace, call.name, result, step);
      if (result.kind === "pending_action") {
        pendingActionIds.push(result.pending_action_id);
      }
      outputItems.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    try {
      current = await client.value.responses.create({
        model,
        previous_response_id: current.id,
        input: outputItems,
        tools: TOOL_DEFS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logAssistantRunFailed({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        session_id: ctx.session_id ?? null,
        error_code: "openai_failed",
        error_message: message,
      });
      return { ok: false, failure: { error: "openai_failed", message } };
    }
    iterations += 1;

    if (step === maxIterations - 1 && extractFunctionCalls(current).length > 0) {
      await logAssistantRunFailed({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        session_id: ctx.session_id ?? null,
        error_code: "iteration_limit",
        error_message: `exceeded ${maxIterations} iterations`,
      });
      return {
        ok: false,
        failure: {
          error: "iteration_limit",
          message: "assistant tool loop did not converge",
        },
      };
    }
  }

  const finalText = extractFinalText(current);
  const answer = mapAssistantAnswer({
    finalText,
    toolTrace,
    pendingActionIds,
  });

  await logAssistantRunCompleted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    session_id: ctx.session_id ?? null,
    answer_kind: answer.kind,
    iterations,
    pending_action_count: pendingActionIds.length,
    tool_call_count: toolTrace.length,
  });

  return {
    ok: true,
    data: {
      answer,
      raw_text: finalText,
      tool_trace: toolTrace,
      pending_action_ids: pendingActionIds,
      iterations,
    },
  };
}

function safeGetClient():
  | { ok: true; value: ReturnType<typeof getOpenAI> }
  | { ok: false; failure: RunAssistantFailure } {
  try {
    return { ok: true, value: getOpenAI() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      failure: { error: "openai_failed", message },
    };
  }
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

function trackTrace(
  trace: ToolCallTrace[],
  name: string,
  result: ToolResult,
  step: number,
): void {
  const known = (name in TOOL_TIERS) as boolean;
  const tier = known ? TOOL_TIERS[name as ToolName] : "restricted";
  trace.push({
    name,
    tier,
    result_kind: result.kind,
    step,
  });
}
