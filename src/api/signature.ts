import { createHash, createHmac, randomBytes } from "node:crypto";

export interface SignatureInput {
  method: string;
  /** Request URI exactly as the API sees it: path plus query string. */
  path: string;
  /** Unix timestamp in seconds, as a string. */
  timestamp: string;
  nonce: string;
  /** The raw request body that is sent. */
  body: string;
}

/**
 * Canonical string shared with xibra-api (App\Services\Bot\BotSignature):
 * METHOD, REQUEST_URI, TIMESTAMP, NONCE and SHA256(body), joined by "\n".
 */
export function canonicalString(input: SignatureInput): string {
  return [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    createHash("sha256").update(input.body, "utf8").digest("hex"),
  ].join("\n");
}

export function sign(secret: string, input: SignatureInput): string {
  return createHmac("sha256", secret)
    .update(canonicalString(input), "utf8")
    .digest("hex");
}

/** 32 hex characters; the API accepts 16 to 64 of [A-Za-z0-9_-]. */
export function newNonce(): string {
  return randomBytes(16).toString("hex");
}
