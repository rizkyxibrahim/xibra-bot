import type { Bot, CommandContext, Context } from "grammy";
import type { XibraApiClient } from "../api/client.js";
import type { Logger } from "../logger.js";
import { describeError } from "./errors.js";
import {
  MAX_NOTE_LENGTH,
  formatInvitation,
  parseInviteArgs,
} from "./format.js";

interface Dependencies {
  api: XibraApiClient;
  logger: Logger;
}

const WELCOME = [
  "Welcome to Xibra.",
  "",
  "Use /link <code> to connect your Xibra account. Get a link code from your account first.",
  "Use /help to see all commands.",
].join("\n");

const HELP = [
  "Available commands:",
  "/link <code> - link this Telegram account to your Xibra account",
  "/me - show the linked account",
  "/invite [hours] [note] - create an invitation (Owner only)",
  "/help - show this message",
  "",
  "Never send your password in Telegram.",
].join("\n");

export function registerCommands(
  bot: Bot,
  { api, logger }: Dependencies,
): void {
  type CommandHandler = (
    ctx: CommandContext<Context>,
    telegramUserId: number,
  ) => Promise<void>;

  /** Resolve the Telegram user from the verified update and contain all failures. */
  const run =
    (handler: CommandHandler) =>
    async (ctx: CommandContext<Context>): Promise<void> => {
      const telegramUserId = ctx.from?.id;

      if (telegramUserId === undefined) {
        return;
      }

      try {
        await handler(ctx, telegramUserId);
      } catch (error) {
        await ctx.reply(describeError(error, logger)).catch(() => undefined);
      }
    };

  const linkWithCode = async (
    ctx: CommandContext<Context>,
    telegramUserId: number,
    rawCode: string,
  ): Promise<void> => {
    try {
      const code = rawCode.trim();

      if (code === "") {
        await ctx.reply(
          "Usage: /link <code>\nGet a link code from your Xibra account first.",
        );

        return;
      }

      if (code.length > 32) {
        await ctx.reply("That link code is not valid.");

        return;
      }

      const { data } = await api.linkTelegram({
        code,
        telegramUserId,
        telegramUsername: ctx.from?.username,
      });

      await ctx.reply(`Linked to ${data.user.username}. Try /me.`);
    } finally {
      // Remove the message that carried the code (best effort).
      await ctx.deleteMessage().catch(() => undefined);
    }
  };

  bot.command(
    "start",
    run(async (ctx, telegramUserId) => {
      const payload = ctx.match.trim();

      if (payload !== "") {
        // Deep link: https://t.me/<bot>?start=<code>
        await linkWithCode(ctx, telegramUserId, payload);

        return;
      }

      await ctx.reply(WELCOME);
    }),
  );

  bot.command(
    "help",
    run(async (ctx) => {
      await ctx.reply(HELP);
    }),
  );

  bot.command(
    "link",
    run(async (ctx, telegramUserId) => {
      await linkWithCode(ctx, telegramUserId, ctx.match);
    }),
  );

  bot.command(
    "me",
    run(async (ctx, telegramUserId) => {
      const { data } = await api.getAccount(telegramUserId);

      const roles =
        (data.roles ?? []).map((role) => role.label).join(", ") || "none";
      const email =
        data.email === null
          ? "not set"
          : data.email_verified_at !== null
            ? "verified"
            : "not verified";

      await ctx.reply(
        [
          `Name: ${data.name}`,
          `Username: ${data.username}`,
          `Roles: ${roles}`,
          `Email: ${email}`,
        ].join("\n"),
      );
    }),
  );

  bot.command(
    "invite",
    run(async (ctx, telegramUserId) => {
      const { hours, note } = parseInviteArgs(ctx.match);

      if (note !== undefined && note.length > MAX_NOTE_LENGTH) {
        await ctx.reply(
          `The note is too long (${MAX_NOTE_LENGTH} characters at most).`,
        );

        return;
      }

      const { data } = await api.createInvitation({
        telegramUserId,
        expiresInHours: hours,
        note,
      });

      // The invitation secrets must not be forwarded or saved from the chat.
      await ctx.reply(formatInvitation(data), {
        parse_mode: "HTML",
        protect_content: true,
      });
    }),
  );
}
