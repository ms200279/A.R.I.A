"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/types/assistant-ui";

import MessageBubble from "./MessageBubble";

type Props = {
  messages: ChatMessage[];
  isThinking: boolean;
};

/**
 * 세로 스크롤 메시지 리스트.
 * 새 메시지가 오거나 thinking 상태가 변하면 맨 아래로 부드럽게 스크롤한다.
 */
export default function MessageList({ messages, isThinking }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  return (
    <div className="flex flex-col gap-5 pb-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {isThinking ? <ThinkingBubble /> : null}
      <div ref={bottomRef} />
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-1.5" aria-label="생각 중">
          <span className="sr-only">응답을 생성하고 있습니다</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}
