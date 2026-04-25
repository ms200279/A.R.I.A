"use client";

import { useCallback, useRef, useState } from "react";

export type CopyToClipboardState = "idle" | "copied" | "error";

/**
 * `navigator.clipboard` 실패 시 `execCommand` 폴백( 구형/일부 권한 환경 ).
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* try fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type Options = { copiedVisibleMs?: number };

export function useCopyToClipboard(options: Options = {}) {
  const { copiedVisibleMs = 2200 } = options;
  const [state, setState] = useState<CopyToClipboardState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState("idle");
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const ok = await writeClipboard(text);
      if (ok) {
        setState("copied");
        timeoutRef.current = setTimeout(() => {
          setState("idle");
          timeoutRef.current = null;
        }, copiedVisibleMs);
        return true;
      }
      setState("error");
      return false;
    },
    [copiedVisibleMs],
  );

  return { state, copy, reset, isError: state === "error" };
}
