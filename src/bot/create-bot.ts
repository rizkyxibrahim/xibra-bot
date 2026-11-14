import { Bot, type Context, type NextFunction } from "grammy";
import type { XibraApiClient } from "../api/client.js";
import type { Logger } from "../logger.js";
import { registerWizard } from "../core/wizard.js";
import { registerHelp } from "../modules/help/index.js";
import { registerHome } from "../modules/home/index.js";
import { modules } from "../modules/index.js";
import { registerCommands } from "./commands.js";

/**
 * Only private chats are served. Codes and invitations must never appear in a group.
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
      .reply("Silakan chat dengan saya secara pribadi.")
      .catch(() => undefined);
  }
}

export function createBot(
  token: string,
  deps: { api: XibraApiClient; logger: Logger },
): Bot {
  const bot = new Bot(token);

  bot.use(privateChatOnly);

  registerHome(bot, deps, modules);
  registerHelp(bot, modules);
  registerWizard(bot);

  for (const module of modules) {
    module.register(bot, deps);
  }

  // Legacy handlers, now only /link. Registered last so every newer handler wins.
  registerCommands(bot, deps);

  bot.on("message", async (ctx) => {
    await ctx.reply("Ketik /start untuk membuka menu.");
  });

  bot.catch((error) => {
    deps.logger.error("Unhandled bot error.", {
      updateId: error.ctx.update.update_id,
      error: error.error instanceof Error ? error.error.message : "unknown",
    });
  });

  return bot;
}
