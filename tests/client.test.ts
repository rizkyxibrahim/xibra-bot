import { describe, expect, it } from "vitest";
import { XibraApiClient } from "../src/api/client.js";
import { ApiUnavailableError } from "../src/api/errors.js";
import { sign } from "../src/api/signature.js";

const SECRET = "test-secret-".repeat(6);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientWith(fetchImpl: typeof fetch): XibraApiClient {
  return new XibraApiClient({
    baseUrl: "http://127.0.0.1:8000",
    keyId: "test-key",
    secret: SECRET,
    timeoutMs: 5000,
    fetchImpl,
    now: () => 1_700_000_000_000,
    nonce: () => "fixed-nonce-0123456789",
  });
}

const accountEnvelope = {
  success: true,
  code: "BOT_ACCOUNT_RETRIEVED",
  message: "Account retrieved successfully.",
  data: { id: 1, username: "alice" },
  meta: null,
};

describe("XibraApiClient", () => {
  it("sends the signed headers and the exact body that was signed", async () => {
    let captured: { url: string; init: RequestInit } | undefined;

    const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
      captured = { url: String(input), init: init ?? {} };

      return jsonResponse(accountEnvelope);
    }) as typeof fetch;

    await clientWith(fetchImpl).getAccount(1001);

    expect(captured?.url).toBe("http://127.0.0.1:8000/api/v1/bot/account");

    const headers = captured?.init.headers as Record<string, string>;
    const body = captured?.init.body as string;

    expect(body).toBe('{"telegram_user_id":1001}');
    expect(headers["X-Xibra-Key-Id"]).toBe("test-key");
    expect(headers["X-Xibra-Timestamp"]).toBe("1700000000");
    expect(headers["X-Xibra-Nonce"]).toBe("fixed-nonce-0123456789");
    expect(headers["X-Xibra-Signature"]).toBe(
      sign(SECRET, {
        method: "POST",
        path: "/api/v1/bot/account",
        timestamp: "1700000000",
        nonce: "fixed-nonce-0123456789",
        body,
      }),
    );
  });

  it("omits the optional username when it is absent", async () => {
    let sentBody = "";

    const fetchImpl = (async (_input: URL | string, init?: RequestInit) => {
      sentBody = String(init?.body);

      return jsonResponse({ ...accountEnvelope, code: "TELEGRAM_LINKED" }, 201);
    }) as typeof fetch;

    await clientWith(fetchImpl).linkTelegram({
      code: "ABCDE-FGHJK",
      telegramUserId: 7,
    });

    expect(JSON.parse(sentBody)).toEqual({
      code: "ABCDE-FGHJK",
      telegram_user_id: 7,
    });
  });

  it("maps an error envelope to an ApiError", async () => {
    const fetchImpl = (async () =>
      jsonResponse(
        {
          success: false,
          code: "TELEGRAM_NOT_LINKED",
          message: "No Telegram account is linked.",
          data: null,
          meta: null,
        },
        404,
      )) as typeof fetch;

    await expect(clientWith(fetchImpl).getAccount(1)).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "TELEGRAM_NOT_LINKED",
    });
  });

  it("reports a non-JSON error response as an unexpected response", async () => {
    const fetchImpl = (async () =>
      new Response("Bad gateway", { status: 502 })) as typeof fetch;

    await expect(clientWith(fetchImpl).getAccount(1)).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      code: "UNEXPECTED_RESPONSE",
    });
  });

  it("reports a network failure as unavailable", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    await expect(clientWith(fetchImpl).getAccount(1)).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
  });

  it("reports a successful non-envelope response as unavailable", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ hello: "world" })) as typeof fetch;

    await expect(clientWith(fetchImpl).getAccount(1)).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
  });
});
