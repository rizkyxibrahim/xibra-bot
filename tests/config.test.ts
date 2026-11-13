import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const valid = {
  TELEGRAM_BOT_TOKEN: "123456:ABCdef_ghiJKL-mnoPQRstuVWXyz012345",
  XIBRA_BOT_KEY_ID: "xibra-bot-v1",
  XIBRA_BOT_SECRET: "s".repeat(40),
};

describe("loadConfig", () => {
  it("accepts a valid configuration and applies defaults", () => {
    const config = loadConfig(valid);

    expect(config.apiBaseUrl).toBe("http://127.0.0.1:8000");
    expect(config.requestTimeoutMs).toBe(10000);
    expect(config.logLevel).toBe("info");
  });

  it("rejects a short secret without echoing it", () => {
    const attempt = () =>
      loadConfig({ ...valid, XIBRA_BOT_SECRET: "tiny-secret-value" });

    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow(/XIBRA_BOT_SECRET/);

    try {
      attempt();
    } catch (error) {
      expect((error as Error).message).not.toContain("tiny-secret-value");
    }
  });

  it("requires the Telegram token", () => {
    expect(() => loadConfig({ ...valid, TELEGRAM_BOT_TOKEN: "" })).toThrow(
      /TELEGRAM_BOT_TOKEN/,
    );
  });

  it("rejects an API URL with a path", () => {
    expect(() =>
      loadConfig({ ...valid, XIBRA_API_BASE_URL: "http://127.0.0.1:8000/api" }),
    ).toThrow(/origin only/);
  });

  it("rejects plain http for remote hosts in production", () => {
    expect(() =>
      loadConfig({
        ...valid,
        NODE_ENV: "production",
        XIBRA_API_BASE_URL: "http://api.example.test",
      }),
    ).toThrow(/https in production/);
  });

  it("allows plain http for localhost in production", () => {
    expect(() =>
      loadConfig({
        ...valid,
        NODE_ENV: "production",
        XIBRA_API_BASE_URL: "http://127.0.0.1:8000",
      }),
    ).not.toThrow();
  });
});
