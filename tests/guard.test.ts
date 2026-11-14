import type { Context } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/errors.js";
import { guard } from "../src/core/guard.js";
import type { Logger } from "../src/logger.js";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

describe("guard", () => {
  it("passes through when the handler succeeds", async () => {
    const reply = vi.fn();
    const ctx = { reply } as unknown as Context;

    await guard({ logger }, async () => undefined)(ctx);

    expect(reply).not.toHaveBeenCalled();
  });

  it("tells the user when an external service fails", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const ctx = { reply } as unknown as Context;

    await guard({ logger }, async () => {
      throw new ApiError(502, "EXTERNAL_SERVICE_UNAVAILABLE", "x");
    })(ctx);

    expect(reply).toHaveBeenCalledOnce();
    expect(String(reply.mock.calls[0]?.[0])).toContain(
      "temporarily unavailable",
    );
  });

  it("edits the message when the failure came from a button", async () => {
    const editMessageText = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      callbackQuery: { data: "weather:refresh" },
      editMessageText,
    } as unknown as Context;

    await guard({ logger }, async () => {
      throw new Error("boom");
    })(ctx);

    expect(editMessageText).toHaveBeenCalledOnce();
    expect(String(editMessageText.mock.calls[0]?.[0])).toBe(
      "Something went wrong. Please try again later.",
    );
  });
});
