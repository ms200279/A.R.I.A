"use client";

import { useEffect, useState } from "react";

import { useAssistantChat } from "@/hooks/useAssistantChat";

import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import ParticleSphere from "./ParticleSphere";

/**
 * assistant 메인 영역 전체.
 *
 * 두 가지 모드:
 *   empty state :  sphere 가 화면 중앙에 크게 (hero), 문구 + 입력창이 따라온다.
 *   chat state  :  sphere 가 상단으로 축소 이동, 메시지 리스트가 주 영역을 차지.
 *
 * 전환은 messages.length > 0 으로만 판단하고, 사이즈·레이아웃만 CSS 로 변한다.
 */
export default function AssistantShell() {
  const chat = useAssistantChat();
  const conversing = chat.messages.length > 0;

  // sphere 는 viewport width 에 따라 조금만 스케일링. reflow 최소화를 위해 throttled.
  const sphereSize = useResponsiveSphereSize(conversing);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 상단 영역 - sphere 와 대화. 입력창은 맨 아래 sticky. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* sphere zone */}
        <div
          className={`flex flex-col items-center justify-center px-6 transition-[padding,flex-basis] duration-500 ease-out ${
            conversing
              ? "flex-none pt-8 pb-6"
              : "flex-1 pt-14 pb-8"
          }`}
        >
          <div
            className={`transition-[transform,filter] duration-500 ease-out ${
              conversing ? "scale-[0.55]" : "scale-100"
            }`}
            style={{
              filter:
                chat.visualState === "error"
                  ? "saturate(0.6)"
                  : "saturate(1)",
            }}
          >
            <ParticleSphere state={chat.visualState} size={sphereSize} />
          </div>

          {!conversing ? (
            <div className="mt-6 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                무엇을 도와드릴까요?
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                메모 검색 · 문서 요약 · 일정 확인을 가볍게 시켜 보세요. 저장과 발송은 항상 승인 뒤에만 진행합니다.
              </p>
            </div>
          ) : null}
        </div>

        {/* chat zone (scrollable) */}
        {conversing ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <div className="mx-auto w-full max-w-3xl">
              <MessageList
                messages={chat.messages}
                isThinking={chat.isSending}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* 입력창 - 하단 sticky */}
      <div className="sticky bottom-0 z-10 border-t border-white/5 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/95 to-[var(--bg-base)]/0 px-6 pb-6 pt-4">
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            value={chat.input}
            onChange={chat.setInput}
            onSubmit={chat.send}
            onFocus={() => chat.setFocused(true)}
            onBlur={() => chat.setFocused(false)}
            disabled={chat.isSending}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 화면 폭에 따른 sphere 크기.
 *  - empty state 가 더 크고, chat state 에서는 transform scale 로 축소한다.
 *  - 여기서는 기본 렌더 사이즈만 폭에 맞춰 리턴.
 */
function useResponsiveSphereSize(_conversing: boolean): number {
  const [size, setSize] = useState(360);
  useEffect(() => {
    function compute() {
      if (typeof window === "undefined") return;
      const w = window.innerWidth;
      if (w < 640) setSize(260);
      else if (w < 1024) setSize(320);
      else setSize(380);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return size;
}
