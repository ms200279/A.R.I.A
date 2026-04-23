"use client";

/**
 * 서버 로그아웃 엔드포인트를 호출한다.
 *
 * - 쿠키 세션 정리는 서버(`POST /api/auth/logout`)가 수행한다. 응답의 Set-Cookie 로
 *   브라우저 쿠키가 비워지므로 클라이언트 쪽에서 별도의 세션 조작은 하지 않는다.
 * - 네트워크/서버 어떤 단계에서 실패하더라도 사용자가 판단할 수 있게 최소 문자열을 반환한다.
 * - 상세 에러는 서버 로그(후속 `lib/logging`)에서 관리할 책임.
 */
export async function requestServerSignOut(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      let detail = "logout_failed";
      try {
        const body: unknown = await res.json();
        if (
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
        ) {
          detail = (body as { error: string }).error;
        }
      } catch {
        // JSON 파싱 실패는 무시하고 기본 사유 유지.
      }
      return { ok: false, error: detail };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}
