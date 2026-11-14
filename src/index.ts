import { XibraApiClient } from "./api/client.js";
import { createBot } from "./bot/create-bot.js";
import { ConfigError, loadConfig, loadEnvFileIfPresent } from "./config.js";
import { createLogger } from "./logger.js";
import { commandMenu } from "./modules/index.js";

loadEnvFileIfPresent();

let config;

try {
  config = loadConfig();
} catch (error) {
  console.error(
    error instanceof ConfigError
      ? error.message
      : "Could not load the configuration.",
  );
  process.exit(1);
}

const logger = createLogger(config.logLevel);

const api = new XibraApiClient({
  baseUrl: config.apiBaseUrl,
  keyId: config.keyId,
  secret: config.secret,
  timeoutMs: config.requestTimeoutMs,
});

const bot = createBot(config.telegramToken, { api, logger });

const shutdown = (signal: string): void => {
  logger.info("Stopping the bot.", { signal });
  void bot.stop();
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

await bot.api.setMyCommands(commandMenu());

// Pending updates are dropped so stale commands never run after a restart.
await bot.start({
  drop_pending_updates: true,
  onStart: (info) =>
    logger.info("The bot is running with long polling.", {
      username: info.username,
    }),
});
