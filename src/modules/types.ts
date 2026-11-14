import type { Bot } from "grammy";
import type { XibraApiClient } from "../api/client.js";
import type { Logger } from "../logger.js";

export interface ModuleDeps {
  api: XibraApiClient;
  logger: Logger;
}

export interface HelpEntry {
  /** Telegram command, for example "/me". Omit for button-only entries. */
  command?: string;
  description: string;
}

export interface BotModule {
  id: string;
  title: string;
  icon: string;
  /** Hidden from the home screen for members. */
  ownerOnly?: boolean;
  help: HelpEntry[];
  register(bot: Bot, deps: ModuleDeps): void;
}
