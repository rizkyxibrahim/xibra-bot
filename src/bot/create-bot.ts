import { Bot, type Context, type NextFunction } from "grammy";
import type { XibraApiClient } from "../api/client.js";
import type { Logger } from "../logger.js";
import { registerCommands } from "./commands.js";

/**
 * Only private chats are served. Codes and invitations must never be
 * typed or shown in a group.
 */
export async function privateChatOnly(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (ctx.chat?.type === "private" && ctx.from !== undefined) {
    await next();

    return;
  }

  if (ctx.message?.text?.startsWith("/")) {
    await ctx
      .reply("Please talk to me in a private chat.")
      .catch(() => undefined);
  }
}

export function createBot(
  token: string,
  deps: { api: XibraApiClient; logger: Logger },
): Bot {
  const bot = new Bot(token);

  bot.use(privateChatOnly);
  registerCommands(bot, deps);

  bot.on("message", async (ctx) => {
    await ctx.reply("I only understand commands. Use /help.");
  });

  bot.catch((error) => {
    deps.logger.error("Unhandled bot error.", {
      updateId: error.ctx.update.update_id,
      error: error.error instanceof Error ? error.error.message : "unknown",
    });
  });

  return bot;
}
