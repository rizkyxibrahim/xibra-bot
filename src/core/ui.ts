import { InlineKeyboard, type Context } from "grammy";

export const ICON = {
  home: "🏠",
  back: "⬅️",
  cancel: "✖️",
  account: "👤",
  telegram: "🔗",
  invite: "📨",
  help: "❓",
  soon: "🚧",
  refresh: "🔄",
} as const;

export interface ShowOptions {
  /** Edit the message that carried the button instead of sending a new one. */
  edit?: boolean;
  html?: boolean;
  /** Blocks forwarding and saving. Reserved for secrets that must never leave the chat. */
  protect?: boolean;
}

export function homeOnly(): InlineKeyboard {
  return new InlineKeyboard().text(`${ICON.home} Home`, "nav:home");
}

export function ack(ctx: Context): Promise<unknown> {
  return ctx.answerCallbackQuery().catch(() => undefined);
}

export async function show(
  ctx: Context,
  text: string,
  keyboard?: InlineKeyboard,
  options: ShowOptions = {},
): Promise<void> {
  const payload = {
    reply_markup: keyboard,
    parse_mode: options.html ? ("HTML" as const) : undefined,
    protect_content: options.protect,
    link_preview_options: { is_disabled: true },
  };

  if (options.edit && ctx.callbackQuery) {
    await ctx
      .editMessageText(text, payload)
      .catch(() => ctx.reply(text, payload));
    return;
  }

  await ctx.reply(text, payload);
}
