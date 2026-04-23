"use client";

import { useCallback, useState } from "react";

import type {
  AssistantAnswerKind,
  AssistantChatMessage,
  AssistantVisualState,
  ChatMessage,
  SystemChatMessage,
  UserChatMessage,
} from "@/types/assistant-ui";

/**
 * assistant 채팅용 클라이언트 훅.
 *
 * 책임:
 *  - 메시지 리스트 보관(로컬 state 만. 장기 저장은 정책상 금지).
 *  - `/api/assistant/query` 호출 + 응답 정규화.
 *  - 구(sphere)에 흘려줄 visual state 도출 (idle | focused | thinking | responding | error).
 *  - 네트워크/형식 오류를 graceful 하게 system 말풍선으로 흡수.
 *
 * 전역 상태 라이브러리를 쓰지 않고 로컬 state + ref 만으로 충분하다.
 * 레이아웃 전환(empty vs 대화중)은 `messages.length > 0` 으로 쉽게 구분한다.
 */

type RawAssistantAnswer =
  | { kind: "direct_answer"; message: string }
  | { kind: "clarification_question"; message: string }
  | { kind: "proposed_action"; message: string; pending_action_ids: string[] }
  | { kind: "approval_required"; message: string; pending_action_ids: string[] }
  | { kind: "blocked"; message: string; reason: string };

type RawQueryResponse = {
  answer: RawAssistantAnswer;
  pending_action_ids?: string[];
  provider?: string;
};

export type UseAssistantChat = {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  send: () => Promise<void>;
  isSending: boolean;
  visualState: AssistantVisualState;
  setFocused: (focused: boolean) => void;
  reset: () => void;
};

const ANSWER_KINDS: readonly AssistantAnswerKind[] = [
  "direct_answer",
  "clarification_question",
  "proposed_action",
  "approval_required",
  "blocked",
];

function isAnswerKind(value: unknown): value is AssistantAnswerKind {
  return (
    typeof value === "string" &&
    (ANSWER_KINDS as readonly string[]).includes(value)
  );
}

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function useAssistantChat(): UseAssistantChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const [focused, setFocusedState] = useState(false);

  const setFocused = useCallback((next: boolean) => {
    setFocusedState(next);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
    setIsSending(false);
    setLastErrorAt(null);
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: UserChatMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    setLastErrorAt(null);

    try {
      const res = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      // 401/400 는 assistant 응답이 아니라 진짜 HTTP 오류다.
      if (!res.ok) {
        const reason =
          res.status === 401
            ? "세션이 만료되었거나 로그인되어 있지 않습니다."
            : `요청이 거절되었습니다 (${res.status}).`;
        appendSystemError(setMessages, reason);
        setLastErrorAt(Date.now());
        return;
      }

      const raw = (await res.json()) as Partial<RawQueryResponse>;
      const normalized = normalizeAnswer(raw);
      setMessages((prev) => [...prev, normalized]);

      if (normalized.kind === "blocked") {
        setLastErrorAt(Date.now());
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "알 수 없는 네트워크 오류가 발생했습니다.";
      appendSystemError(
        setMessages,
        `응답을 받지 못했습니다. ${message.slice(0, 200)}`,
      );
      setLastErrorAt(Date.now());
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  const visualState = deriveVisualState({
    isSending,
    lastErrorAt,
    focused,
  });

  return {
    messages,
    input,
    setInput,
    send,
    isSending,
    visualState,
    setFocused,
    reset,
  };
}

/* ─────────────────────────────────────────────────────────────
 * helpers
 * ────────────────────────────────────────────────────────── */

function appendSystemError(
  setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  message: string,
): void {
  const sys: SystemChatMessage = {
    id: makeId(),
    role: "system",
    content: message,
    createdAt: Date.now(),
    tone: "error",
  };
  setter((prev) => [...prev, sys]);
}

/**
 * 서버에서 오는 answer 를 타입 안전하게 UI 메시지로 변환.
 * 형식이 미묘하게 바뀌어도 UI 가 깨지지 않도록 fallback 처리.
 */
function normalizeAnswer(raw: Partial<RawQueryResponse>): AssistantChatMessage {
  const answer = raw.answer;
  const baseId = makeId();
  const createdAt = Date.now();
  const provider = typeof raw.provider === "string" ? raw.provider : undefined;

  if (!answer || typeof answer !== "object") {
    return {
      id: baseId,
      role: "assistant",
      kind: "blocked",
      content: "응답 형식을 해석하지 못했습니다.",
      reason: "invalid_response_shape",
      createdAt,
      provider,
    };
  }

  const kind = isAnswerKind(answer.kind) ? answer.kind : "direct_answer";
  const content =
    typeof answer.message === "string" && answer.message.length > 0
      ? answer.message
      : fallbackContentFor(kind);

  if (kind === "approval_required" || kind === "proposed_action") {
    const ids = Array.isArray(raw.pending_action_ids)
      ? (raw.pending_action_ids.filter((x) => typeof x === "string") as string[])
      : [];
    return {
      id: baseId,
      role: "assistant",
      kind,
      content,
      pendingActionIds: ids,
      createdAt,
      provider,
    };
  }

  if (kind === "blocked") {
    const reason =
      typeof (answer as { reason?: unknown }).reason === "string"
        ? (answer as { reason: string }).reason
        : "unknown_reason";
    return {
      id: baseId,
      role: "assistant",
      kind: "blocked",
      content,
      reason,
      createdAt,
      provider,
    };
  }

  return {
    id: baseId,
    role: "assistant",
    kind,
    content,
    createdAt,
    provider,
  };
}

function fallbackContentFor(kind: AssistantAnswerKind): string {
  switch (kind) {
    case "approval_required":
      return "저장안을 만들었습니다. 메모 목록에서 승인해 주세요.";
    case "proposed_action":
      return "이 내용으로 진행할까요?";
    case "clarification_question":
      return "조금 더 구체적으로 알려주시겠어요?";
    case "blocked":
      return "요청을 처리할 수 없습니다.";
    case "direct_answer":
    default:
      return "(빈 응답)";
  }
}

function deriveVisualState(input: {
  isSending: boolean;
  lastErrorAt: number | null;
  focused: boolean;
}): AssistantVisualState {
  // 에러는 2.5초 동안만 부드럽게 살짝만 유지한다.
  if (
    input.lastErrorAt !== null &&
    Date.now() - input.lastErrorAt < 2500
  ) {
    return "error";
  }
  if (input.isSending) {
    // thinking ↔ responding 은 현재 stream 이 없으니 동일한 "활성" 상태로 본다.
    // 이후 스트리밍이 붙으면 단계를 쪼갤 수 있다.
    return "thinking";
  }
  if (input.focused) return "focused";
  return "idle";
}
