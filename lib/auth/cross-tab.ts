"use client";

/**
 * 탭 간 "인증 완료" 신호 전달 유틸.
 *
 * 전달 수단 (우선순위):
 *   1. BroadcastChannel — 지원 브라우저에서 즉시/저비용으로 동일 오리진 탭 간 통신
 *   2. localStorage `storage` 이벤트 — BroadcastChannel 미지원 환경의 백업
 *
 * 설계 원칙:
 * - "완료" 신호 외의 세션 데이터는 실어 나르지 않는다. 실제 세션은 Supabase 쿠키로
 *   브라우저에 자동 설정되므로, 이 채널은 "이동해도 된다"는 신호만 전달한다.
 * - payload 에는 `next` 경로와 시각을 포함해 수신 탭이 라우팅에 활용할 수 있게 한다.
 * - DOM/Window 접근은 모두 try/catch 로 감싸 프라이빗 모드 등에서도 앱이 죽지 않게 한다.
 */

export const AUTH_CHANNEL_NAME = "aria-auth";
export const AUTH_STORAGE_KEY = "aria:auth:completed";

export type AuthCompletedPayload = {
  kind: "auth-completed";
  at: number;
  next: string;
};

function makePayload(next: string): AuthCompletedPayload {
  return { kind: "auth-completed", at: Date.now(), next };
}

function isPayload(value: unknown): value is AuthCompletedPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.kind === "auth-completed" &&
    typeof v.at === "number" &&
    typeof v.next === "string"
  );
}

export function notifyAuthCompleted(next: string = "/"): void {
  if (typeof window === "undefined") return;
  const payload = makePayload(next);

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(AUTH_CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    }
  } catch {
    // BroadcastChannel 미지원/차단. storage 경로로 대체.
  }

  try {
    // storage 이벤트는 "값이 바뀔 때"만 발생하므로 매번 at 갱신된 JSON 을 쓴다.
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 프라이빗 모드 등에서 storage 차단. 감지는 polling 이 마지막 보루.
  }
}

/**
 * 인증 완료 신호 구독.
 * 반환된 함수를 호출하면 모든 리스너가 해제된다.
 */
export function subscribeAuthCompleted(
  handler: (payload: AuthCompletedPayload) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const cleanups: Array<() => void> = [];

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(AUTH_CHANNEL_NAME);
      const onMessage = (event: MessageEvent<unknown>) => {
        if (isPayload(event.data)) handler(event.data);
      };
      bc.addEventListener("message", onMessage);
      cleanups.push(() => {
        bc.removeEventListener("message", onMessage);
        bc.close();
      });
    }
  } catch {
    // 무시.
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (isPayload(parsed)) handler(parsed);
    } catch {
      // 손상된 값은 무시.
    }
  };
  window.addEventListener("storage", onStorage);
  cleanups.push(() => window.removeEventListener("storage", onStorage));

  return () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // 해제 실패는 무시.
      }
    }
  };
}
