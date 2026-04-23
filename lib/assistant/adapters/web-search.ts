import "server-only";

/**
 * 웹 검색 어댑터.
 *
 * 실공급자(예: Tavily, Bing, Brave) 미결정. 지금은 `not_configured` 를 반환한다.
 * 이후 공급자 확정 시 `WebSearchAdapter` 구현체로 교체한다.
 * 반환 결과는 반드시 `lib/safety.prepareUntrusted` 를 통과시킨 뒤에만
 * assistant context 로 재주입되어야 한다 (run-assistant 에서 강제).
 */

export type WebSearchQuery = {
  query: string;
  limit?: number;
};

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult =
  | { status: "ok"; hits: WebSearchHit[] }
  | { status: "not_configured"; provider: string | null };

export interface WebSearchAdapter {
  readonly provider: string;
  search(input: WebSearchQuery): Promise<WebSearchResult>;
}

export const webSearchNotConfigured: WebSearchAdapter = {
  provider: "stub",
  async search() {
    return { status: "not_configured", provider: null };
  },
};

let current: WebSearchAdapter = webSearchNotConfigured;

export function getWebSearchAdapter(): WebSearchAdapter {
  return current;
}

export function setWebSearchAdapter(adapter: WebSearchAdapter): void {
  current = adapter;
}
