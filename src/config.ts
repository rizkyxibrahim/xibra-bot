import type { LogLevel } from "./logger.js";

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigError";
  }
}

export interface BotConfig {
  telegramToken: string;
  apiBaseUrl: string;
  keyId: string;
  secret: string;
  requestTimeoutMs: number;
  logLevel: LogLevel;
}

const LOG_LEVELS: readonly string[] = ["debug", "info", "warn", "error"];
const MIN_SECRET_LENGTH = 32;

/**
 * Load a local .env file when one exists. In production the real
 * environment (for example systemd) provides the values instead.
 */
export function loadEnvFileIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Validate the environment. Problems name the variable only; values
 * are never echoed.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const problems: string[] = [];

  const telegramToken = (env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(telegramToken)) {
    problems.push("TELEGRAM_BOT_TOKEN is missing or malformed.");
  }

  const keyId = (env.XIBRA_BOT_KEY_ID ?? "").trim();
  if (keyId === "") {
    problems.push("XIBRA_BOT_KEY_ID is required.");
  }

  const secret = env.XIBRA_BOT_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `XIBRA_BOT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }

  const apiBaseUrl = parseApiBaseUrl(
    env.XIBRA_API_BASE_URL ?? "http://127.0.0.1:8000",
    env.NODE_ENV === "production",
    problems,
  );

  const requestTimeoutMs = Number(env.XIBRA_API_TIMEOUT_MS ?? "10000");
  if (
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1000 ||
    requestTimeoutMs > 60000
  ) {
    problems.push(
      "XIBRA_API_TIMEOUT_MS must be an integer between 1000 and 60000.",
    );
  }

  const logLevel = env.LOG_LEVEL ?? "info";
  if (!LOG_LEVELS.includes(logLevel)) {
    problems.push("LOG_LEVEL must be one of debug, info, warn, error.");
  }

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return {
    telegramToken,
    apiBaseUrl,
    keyId,
    secret,
    requestTimeoutMs,
    logLevel: logLevel as LogLevel,
  };
}

function parseApiBaseUrl(
  raw: string,
  production: boolean,
  problems: string[],
): string {
  try {
    const url = new URL(raw.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      problems.push("XIBRA_API_BASE_URL must use http or https.");
    } else if (production && url.protocol !== "https:" && !local) {
      problems.push("XIBRA_API_BASE_URL must use https in production.");
    }

    if (url.pathname !== "/" || url.search !== "") {
      problems.push(
        "XIBRA_API_BASE_URL must be an origin only, without a path or query.",
      );
    }

    return url.origin;
  } catch {
    problems.push("XIBRA_API_BASE_URL is not a valid URL.");

    return "";
  }
}
