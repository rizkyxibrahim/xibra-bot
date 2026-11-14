import { InlineKeyboard, type Context } from "grammy";
import type { AccountData } from "../../api/types.js";
import { loadLinkedAccount, UNLINKED_MESSAGE } from "../../core/linked.js";
import { homeOnly, ICON, ack, show } from "../../core/ui.js";
import type { BotModule, ModuleDeps } from "../types.js";

function accountText(account: AccountData): string {
  const roles =
    (account.roles ?? []).map((role) => role.label).join(", ") || "Member";
  const email = !account.email
    ? "belum diisi"
    : account.email_verified_at
      ? "terverifikasi"
      : "belum diverifikasi";

  return [
    `${ICON.account} Akun`,
    "",
    `Nama: ${account.name}`,
    `Username: @${account.username}`,
    `Peran: ${roles}`,
    `Email: ${email}`,
    `${ICON.telegram} Telegram: tertaut`,
  ].join("\n");
}

async function open(
  ctx: Context,
  deps: ModuleDeps,
  edit: boolean,
): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const account = await loadLinkedAccount(deps.api, userId);

  if (!account) {
    await show(ctx, UNLINKED_MESSAGE, homeOnly(), { edit });
    return;
  }

  const keyboard = new InlineKeyboard()
    .text(`${ICON.refresh} Muat ulang`, "open:account")
    .row()
    .text(`${ICON.home} Home`, "nav:home");

  await show(ctx, accountText(account), keyboard, { edit });
}

export const account: BotModule = {
  id: "account",
  title: "Akun",
  icon: ICON.account,
  help: [
    { command: "/me", description: "Lihat akun yang tertaut" },
    {
      command: "/link",
      description: "Tautkan akun dengan kode dari dashboard",
    },
  ],
  register(bot, deps) {
    bot.command("me", (ctx) => open(ctx, deps, false));

    bot.callbackQuery("open:account", async (ctx) => {
      await ack(ctx);
      await open(ctx, deps, true);
    });
  },
};
