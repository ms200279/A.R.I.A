import "server-only";

import { evaluateAssistantPreGate } from "@/lib/policies/assistant";
import {
  logAssistantPolicyBlocked,
  logAssistantProviderError,
  logAssistantRequestReceived,
  logAssistantRunCompleted,
  logAssistantRunFailed,
} from "@/lib/logging/audit-log";
import { writePolicyLog } from "@/lib/logging/policy-log";

import { resolveMaxIterations } from "./client";
import { executeTool } from "./execute-tool";
import { resolveProvider, resolveProviderName } from "./providers";
import type {
  AssistantProvider,
  AssistantProviderRunResult,
  ProviderToolExecutor,
} from "./providers";
import { mapAssistantAnswer } from "./response-mapper";
import { SYSTEM_PROMPT } from "./system-prompt";
import { NEUTRAL_TOOL_DEFS, TOOL_TIERS, type ToolName } from "./tools";
import type {
  AssistantRunContext,
  RunAssistantResult,
  ToolCallTrace,
  ToolResult,
} from "./types";

export type RunAssistantInput = {
  userMessage: string;
  ctx: AssistantRunContext;
};

export type RunAssistantOutput = {
  ok: true;
  data: RunAssistantResult;
  provider: string;
};

/**
 * Assistant 실행 루프.
 *
 * 흐름:
 *   1. pre-gate 정책 평가: 명시적 금지 명령은 LLM 호출 없이 blocked 로 즉시 종료.
 *   2. provider 해석: ASSISTANT_PROVIDER env 로 gemini | openai 선택.
 *   3. provider.run 에 tool executor 콜백을 넘겨 루프 위임.
 *   4. 도구 호출은 executeTool 이 티어/스키마/정책을 모두 검증한다.
 *   5. provider 오류 / 반복 상한 초과는 graceful 하게 blocked answer 로 정규화.
 *
 * 규약:
 *   - 이 함수는 throw 하지 않는다. 항상 `{ ok: true, data, provider }` 를 반환한다.
 *   - 결과의 answer.kind 로 성공/차단/승인대기/명료화 구분을 전달한다.
 *   - 내부적으로 뚫린 예외는 모두 log + answer=blocked 로 흡수한다.
 */
export async function runAssistant(
  input: RunAssistantInput,
): Promise<RunAssistantOutput> {
  const { userMessage } = input;
  // tool executor 안에서 현재 턴의 사용자 메시지를 기반으로 저장 의도를 재검증하려면
  // user_message 가 ctx 에 실려 있어야 한다. 호출자가 보내지 않았더라도 여기서 주입한다.
  const ctx: AssistantRunContext = {
    ...input.ctx,
    user_message: input.ctx.user_message ?? userMessage,
  };
  const maxIterations = resolveMaxIterations();
  const providerName = resolveProviderName();

  await logAssistantRequestReceived({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    session_id: ctx.session_id ?? null,
    message_length: userMessage.length,
  });

  // 1) pre-gate
  const gate = evaluateAssistantPreGate(userMessage);
  if (gate.decision === "block") {
    await logAssistantPolicyBlocked({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      session_id: ctx.session_id ?? null,
      reason: gate.reason,
      matched_pattern: gate.matched_pattern,
    });
    await writePolicyLog({
      event_type: "assistant.pre_gate.blocked",
      module_name: "assistant.policy",
      actor_type: "user",
      actor_id: ctx.user_id,
      decision: "denied",
      rule: gate.reason,
      target_type: "assistant_run",
      metadata: {
        matched_pattern: gate.matched_pattern,
        session_id: ctx.session_id ?? null,
      },
    });
    return finalizeBlocked({
      providerName,
      reason: gate.reason,
      message: gate.user_message,
    });
  }

  // 2) provider resolve
  let provider: AssistantProvider;
  try {
    provider = resolveProvider();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAssistantProviderError({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      session_id: ctx.session_id ?? null,
      provider: providerName,
      error_message: message,
    });
    await logAssistantRunFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      session_id: ctx.session_id ?? null,
      error_code: "provider_not_configured",
      error_message: message,
    });
    return finalizeBlocked({
      providerName,
      reason: "provider_not_configured",
      message:
        "assistant provider 가 아직 설정되지 않았습니다. 서버 환경변수를 확인해 주세요.",
    });
  }

  // 3) tool executor + trace 집계
  const toolTrace: ToolCallTrace[] = [];
  const pendingActionIds: string[] = [];
  const toolExecutor: ProviderToolExecutor = async (name, args) => {
    const result = await executeTool(name, args, ctx);
    trackTrace(toolTrace, name, result, toolTrace.length);
    if (result.kind === "pending_action") {
      pendingActionIds.push(result.pending_action_id);
    }
    return result;
  };

  // 4) provider.run
  let runResult: AssistantProviderRunResult;
  try {
    runResult = await provider.run({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tools: NEUTRAL_TOOL_DEFS,
      toolExecutor,
      maxIterations,
    });
  } catch (err) {
    // provider.run 은 내부에서 에러를 먹고 ok:false 를 돌려주도록 되어 있지만,
    // 방어적으로 한 번 더 감싼다.
    const message = err instanceof Error ? err.message : String(err);
    runResult = { ok: false, error: "provider_error", message };
  }

  // 5) provider 실패 → graceful blocked
  if (!runResult.ok) {
    if (runResult.error === "provider_error") {
      await logAssistantProviderError({
        actor_id: ctx.user_id,
        actor_email: ctx.user_email ?? null,
        session_id: ctx.session_id ?? null,
        provider: provider.name,
        error_message: runResult.message,
      });
    }
    await logAssistantRunFailed({
      actor_id: ctx.user_id,
      actor_email: ctx.user_email ?? null,
      session_id: ctx.session_id ?? null,
      error_code: runResult.error,
      error_message: runResult.message,
    });
    return finalizeBlocked({
      providerName: provider.name,
      reason: runResult.error,
      message:
        runResult.error === "iteration_limit"
          ? "응답을 정리하지 못했습니다. 질문을 조금 더 구체적으로 말씀해 주세요."
          : "응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      toolTrace,
      pendingActionIds,
    });
  }

  // 6) 성공 → answer 매핑
  const answer = mapAssistantAnswer({
    finalText: runResult.finalText,
    toolTrace,
    pendingActionIds,
  });

  await logAssistantRunCompleted({
    actor_id: ctx.user_id,
    actor_email: ctx.user_email ?? null,
    session_id: ctx.session_id ?? null,
    answer_kind: answer.kind,
    iterations: runResult.iterations,
    pending_action_count: pendingActionIds.length,
    tool_call_count: toolTrace.length,
  });

  return {
    ok: true,
    provider: provider.name,
    data: {
      answer,
      raw_text: runResult.finalText,
      tool_trace: toolTrace,
      pending_action_ids: pendingActionIds,
      iterations: runResult.iterations,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function finalizeBlocked(params: {
  providerName: string;
  reason: string;
  message: string;
  toolTrace?: ToolCallTrace[];
  pendingActionIds?: string[];
}): RunAssistantOutput {
  return {
    ok: true,
    provider: params.providerName,
    data: {
      answer: {
        kind: "blocked",
        message: params.message,
        reason: params.reason,
      },
      raw_text: "",
      tool_trace: params.toolTrace ?? [],
      pending_action_ids: params.pendingActionIds ?? [],
      iterations: 0,
    },
  };
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
