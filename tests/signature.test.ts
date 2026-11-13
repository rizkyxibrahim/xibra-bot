import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalString,
  newNonce,
  sign,
  type SignatureInput,
} from "../src/api/signature.js";

const base: SignatureInput = {
  method: "post",
  path: "/api/v1/bot/account",
  timestamp: "1700000000",
  nonce: "nonce-0123456789abcdef",
  body: '{"telegram_user_id":1}',
};

describe("signature", () => {
  it("builds the canonical string shared with the API", () => {
    const bodyHash = createHash("sha256").update(base.body).digest("hex");

    expect(canonicalString(base)).toBe(
      [
        "POST",
        "/api/v1/bot/account",
        "1700000000",
        "nonce-0123456789abcdef",
        bodyHash,
      ].join("\n"),
    );
  });

  it("produces a 64 character lowercase hex signature", () => {
    expect(sign("secret", base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(sign("secret", base)).toBe(sign("secret", base));
  });

  it.each([
    ["secret", "other-secret", base],
    ["path", "secret", { ...base, path: "/api/v1/bot/other" }],
    ["timestamp", "secret", { ...base, timestamp: "1700000001" }],
    ["nonce", "secret", { ...base, nonce: "another-nonce-0123456789" }],
    ["body", "secret", { ...base, body: '{"telegram_user_id":2}' }],
  ])("changes when the %s changes", (_name, secret, input) => {
    expect(sign(secret, input)).not.toBe(sign("secret", base));
  });

  it("generates nonces the API accepts", () => {
    const nonce = newNonce();

    expect(nonce).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(newNonce()).not.toBe(nonce);
  });
});
