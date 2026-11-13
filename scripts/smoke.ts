import { XibraApiClient } from "../src/api/client.js";
import { ApiError } from "../src/api/errors.js";
import { loadConfig, loadEnvFileIfPresent } from "../src/config.js";

loadEnvFileIfPresent();

const config = loadConfig();

const client = new XibraApiClient({
  baseUrl: config.apiBaseUrl,
  keyId: config.keyId,
  secret: config.secret,
  timeoutMs: config.requestTimeoutMs,
});

try {
  await client.getAccount(1);
  console.log("Unexpected: Telegram user 1 is linked to an account.");
} catch (error) {
  if (error instanceof ApiError && error.code === "TELEGRAM_NOT_LINKED") {
    console.log("OK: the API accepted the signed request.");
    process.exit(0);
  }

  if (error instanceof ApiError && error.code === "SERVICE_UNAUTHENTICATED") {
    console.error(
      "FAILED: the API rejected the signature. Check the key id, the secret and the system clock.",
    );
  } else {
    console.error("FAILED:", error instanceof Error ? error.message : error);
  }

  process.exit(1);
}
