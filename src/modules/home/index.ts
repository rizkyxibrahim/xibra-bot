import { InlineKeyboard, type Bot, type Context } from "grammy";
import type { AccountData } from "../../api/types.js";
import {
  isOwner,
  loadLinkedAccount,
  UNLINKED_MESSAGE,
} from "../../core/linked.js";
import { formatNowWib, greeting } from "../../core/time.js";
import { ICON, ack, show } from "../../core/ui.js";
import type { BotModule, ModuleDeps } from "../types.js";

function emailStatus(account: AccountData): string {
  if (!account.email) return "belum diisi";

  return account.email_verified_at ? "terverifikasi" : "belum diverifikasi";
}

/**
 * The home screen. Only linked accounts see the menu; everyone else gets the
 * linking instructions.
 */
export function registerHome(
  bot: Bot,
  deps: ModuleDeps,
  modules: BotModule[],
): void {
  async function render(ctx: Context, edit: boolean): Promise<void> {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const account = await loadLinkedAccount(deps.api, userId);

    if (!account) {
      await show(
        ctx,
        `Halo! Saya Xibra Bot.\n\n${UNLINKED_MESSAGE}`,
        undefined,
        { edit },
      );
      return;
    }

    const owner = isOwner(account);
    let pending = 0;

    if (owner) {
      try {
        const { data: items } = await deps.api.listInvitations({
          telegramUserId: userId,
          perPage: 50,
        });
        pending = items.filter((item) => item.status === "pending").length;
      } catch {
        // The count is optional; the home screen still renders without it.
      }
    }

    const roles =
      (account.roles ?? []).map((role) => role.label).join(", ") || "Member";

    const lines = [
      `${greeting()}, ${account.name}! 👋`,
      formatNowWib(),
      "",
      `${ICON.account} @${account.username} · ${roles}`,
      `📧 Email: ${emailStatus(account)}`,
      `${ICON.telegram} Telegram: tertaut`,
    ];

    if (owner && pending > 0) {
      lines.push(`${ICON.invite} Undangan menunggu: ${pending}`);
    }

    lines.push(
      "",
      `${ICON.soon} Shift, jadwal, tugas, pengingat, keuangan, cuaca, dan berita segera hadir.`,
    );

    const visible = modules.filter((module) => !module.ownerOnly || owner);
    const keyboard = new InlineKeyboard();

    visible.forEach((module, index) => {
      keyboard.text(`${module.icon} ${module.title}`, `open:${module.id}`);
      if (index % 2 === 1) keyboard.row();
    });

    if (visible.length % 2 === 1) keyboard.row();

    keyboard
      .text(`${ICON.help} Bantuan`, "nav:help")
      .text(`${ICON.refresh} Muat ulang`, "nav:home");

    await show(ctx, lines.join("\n"), keyboard, { edit });
  }

  bot.command(["start", "menu"], (ctx) => render(ctx, false));

  bot.callbackQuery("nav:home", async (ctx) => {
    await ack(ctx);
    await render(ctx, true);
  });
}
