import type { Context } from "grammy";
import { describeError } from "../bot/errors.js";
import type { Logger } from "../logger.js";
import { homeOnly, show } from "./ui.js";

/**
 * Wrap a handler so a failure always ends in a short, safe message for the
 * user instead of being logged and silently dropped by `bot.catch`.
 */
export function guard(
  deps: { logger: Logger },
  handler: (ctx: Context) => Promise<void>,
): (ctx: Context) => Promise<void> {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      const text = describeError(error, deps.logger);

      await show(ctx, text, homeOnly(), {
        edit: ctx.callbackQuery !== undefined,
      }).catch(() => undefined);
    }
  };
}
