import "server-only";

/**
 * 날씨 어댑터.
 *
 * 실제 공급자(예: OpenWeather, kma) 는 아직 연동되지 않았다.
 * 여기서는 `not_configured` 를 반환하고, 이후 공급자가 확정되면
 * `WeatherAdapter` 를 구현하는 모듈로 교체한다.
 */

export type WeatherQuery = {
  location?: string | null;
};

export type WeatherResult =
  | {
      status: "ok";
      location: string;
      temperature_c: number;
      description: string;
      observed_at: string;
    }
  | { status: "not_configured"; provider: string | null };

export interface WeatherAdapter {
  readonly provider: string;
  fetch(input: WeatherQuery): Promise<WeatherResult>;
}

export const weatherNotConfigured: WeatherAdapter = {
  provider: "stub",
  async fetch() {
    return { status: "not_configured", provider: null };
  },
};

let current: WeatherAdapter = weatherNotConfigured;

export function getWeatherAdapter(): WeatherAdapter {
  return current;
}

export function setWeatherAdapter(adapter: WeatherAdapter): void {
  current = adapter;
}
