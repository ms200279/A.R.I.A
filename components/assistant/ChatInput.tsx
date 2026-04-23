"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * ChatGPT 스타일 입력창.
 *
 * UX:
 *  - Enter 전송, Shift+Enter 줄바꿈, IME(한글 조합) 중 Enter 는 전송하지 않는다.
 *  - 내용 길이에 맞춰 자동 성장. 단 약 10 줄에서 스크롤.
 *  - 전송 버튼은 빈 입력 / loading 중 비활성.
 *  - focus / blur 를 상위 훅으로 올려 sphere 가 반응하게 한다.
 *
 * 접근성:
 *  - aria-label 로 역할 명시.
 *  - disabled 시 cursor 와 색이 또렷이 구분됨.
 */
export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  disabled = false,
  placeholder = "메모를 찾거나, 문서를 요약하거나, 일정을 물어보세요",
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 240; // 약 10 줄
    const next = Math.min(ta.scrollHeight, max);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (composingRef.current) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (disabled) return;
    onSubmit();
  }

  const hasValue = value.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && hasValue) onSubmit();
      }}
      className="w-full"
      aria-label="assistant 입력"
    >
      <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-[var(--bg-raised)]/90 px-4 py-3 shadow-[0_8px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur transition focus-within:border-[color:var(--accent)]/40 focus-within:shadow-[0_8px_40px_-16px_rgba(155,180,255,0.25)]">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-60"
          aria-label="메시지 입력"
        />
        <button
          type="submit"
          disabled={disabled || !hasValue}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-[var(--text-primary)] transition enabled:hover:border-[color:var(--accent)]/40 enabled:hover:bg-[color:var(--accent-soft)] enabled:hover:text-[color:var(--accent-strong)] disabled:opacity-40"
          aria-label="전송"
        >
          {disabled ? <SpinnerDot /> : <ArrowIcon />}
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-[var(--text-tertiary)]">
        Enter 전송 · Shift+Enter 줄바꿈 · aria 는 쓰기 작업을 사용자의 승인 후에만 수행합니다.
      </p>
    </form>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function SpinnerDot() {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]"
    />
  );
}
