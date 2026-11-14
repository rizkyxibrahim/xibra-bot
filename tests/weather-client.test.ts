import { describe, expect, it } from "vitest";
import { XibraApiClient } from "../src/api/client.js";

function envelope(data: unknown, code: string): Response {
  return new Response(
    JSON.stringify({ success: true, code, message: "ok", data, meta: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("weather and news client calls", () => {
  it("posts the expected paths and bodies", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];

    const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
      calls.push({
        url: new URL(String(input)).pathname,
        body: JSON.parse(String(init?.body)),
      });

      return envelope(null, "OK");
    }) as typeof fetch;

    const client = new XibraApiClient({
      baseUrl: "http://127.0.0.1:8000",
      keyId: "k",
      secret: "s".repeat(32),
      timeoutMs: 1000,
      fetchImpl,
    });

    await client.getWeather(1);
    await client.showLocation(1);
    await client.saveLocation({
      telegramUserId: 1,
      latitude: -6.2,
      longitude: 106.9,
    });
    await client.deleteLocation(1);
    await client.getNewsCategories(1);
    await client.getNewsHeadlines({ telegramUserId: 1, category: "terkini" });

    expect(calls).toEqual([
      { url: "/api/v1/bot/weather/forecast", body: { telegram_user_id: 1 } },
      {
        url: "/api/v1/bot/weather/location/show",
        body: { telegram_user_id: 1 },
      },
      {
        url: "/api/v1/bot/weather/location",
        body: { telegram_user_id: 1, latitude: -6.2, longitude: 106.9 },
      },
      {
        url: "/api/v1/bot/weather/location/delete",
        body: { telegram_user_id: 1 },
      },
      { url: "/api/v1/bot/news/categories", body: { telegram_user_id: 1 } },
      {
        url: "/api/v1/bot/news/headlines",
        body: { telegram_user_id: 1, category: "terkini" },
      },
    ]);
  });
});
