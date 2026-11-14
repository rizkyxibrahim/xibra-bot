import { InlineKeyboard, type Context } from "grammy";
import { ApiError, ApiUnavailableError } from "../../api/errors.js";
import {
  STATUS_LABELS,
  escapeHtml,
  formatInvitation,
  formatInvitationDetail,
  formatWib,
} from "../../bot/format.js";
import {
  isOwner,
  loadLinkedAccount,
  UNLINKED_MESSAGE,
} from "../../core/linked.js";
import { registerFlow, startFlow } from "../../core/wizard.js";
import { ICON, ack, homeOnly, show } from "../../core/ui.js";
import type { BotModule, ModuleDeps } from "../types.js";

const HOURS = ["1", "24", "72"];

/** Owner-only actions. Members get a short refusal, never the data. */
async function ownerGate(ctx: Context, deps: ModuleDeps): Promise<boolean> {
  const userId = ctx.from?.id;
  if (userId === undefined) return false;

  const account = await loadLinkedAccount(deps.api, userId);

  if (!account) {
    await ctx.reply(UNLINKED_MESSAGE);
    return false;
  }

  if (!isOwner(account)) {
    await ctx.reply("Hanya owner yang bisa mengelola undangan.");
    return false;
  }

  return true;
}

function menuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${ICON.invite} Buat undangan`, "inv:new")
    .row()
    .text("📋 Daftar undangan", "inv:list")
    .row()
    .text(`${ICON.home} Home`, "nav:home");
}

async function showMenu(ctx: Context, edit: boolean): Promise<void> {
  await show(
    ctx,
    `${ICON.invite} Undangan\n\nBuat undangan baru atau lihat daftar yang ada.`,
    menuKeyboard(),
    { edit },
  );
}

async function showList(
  ctx: Context,
  deps: ModuleDeps,
  edit: boolean,
): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const { data: items } = await deps.api.listInvitations({
    telegramUserId: userId,
    perPage: 10,
  });

  const back = new InlineKeyboard()
    .text(`${ICON.invite} Menu undangan`, "open:invitations")
    .text(`${ICON.home} Home`, "nav:home");

  if (items.length === 0) {
    await show(ctx, "Belum ada undangan.", back, { edit });
    return;
  }

  const lines = items.map((item) => {
    const note = item.note ? ` · ${escapeHtml(item.note)}` : "";
    const status = STATUS_LABELS[item.status] ?? item.status;
    return `#${item.id} · ${status} · sampai ${formatWib(item.expires_at)}${note}`;
  });

  const keyboard = new InlineKeyboard();

  for (const item of items) {
    keyboard.text(`🔍 Detail #${item.id}`, `inv:show:${item.id}`);

    if (item.status === "pending") {
      keyboard.text(`🗑 Cabut #${item.id}`, `inv:revoke:${item.id}`);
    }

    keyboard.row();
  }

  keyboard
    .text(`${ICON.invite} Menu undangan`, "open:invitations")
    .text(`${ICON.home} Home`, "nav:home");

  await show(ctx, ["Undangan terbaru:", "", ...lines].join("\n"), keyboard, {
    edit,
    html: true,
  });
}

export const invitations: BotModule = {
  id: "invitations",
  title: "Undangan",
  icon: ICON.invite,
  ownerOnly: true,
  help: [
    {
      command: "/invite",
      description: "Buat undangan lewat langkah-langkah (owner)",
    },
    { command: "/invites", description: "Daftar undangan terbaru (owner)" },
  ],

  register(bot, deps) {
    registerFlow({
      id: "inv",
      title: `${ICON.invite} Buat undangan`,
      steps: [
        {
          key: "hours",
          prompt: () => "Berapa lama undangan ini berlaku?",
          options: [
            { label: "1 jam", value: "1" },
            { label: "24 jam", value: "24" },
            { label: "72 jam", value: "72" },
          ],
          accept: (input) =>
            HOURS.includes(input)
              ? { ok: true, value: input }
              : { ok: false, message: "Pilih 1, 24, atau 72 jam." },
        },
        {
          key: "note",
          prompt: () => "Tambahkan catatan singkat untuk undangan ini?",
          freeText: true,
          optional: true,
          accept: (input) => ({ ok: true, value: input.slice(0, 200) }),
        },
      ],
      finish: async (data, ctx) => {
        const telegramUserId = ctx.from?.id;
        if (telegramUserId === undefined) throw new Error("Missing sender.");

        const { data: created } = await deps.api.createInvitation({
          telegramUserId,
          expiresInHours: Number(data.hours),
          note: data.note || undefined,
        });

        // The code is a secret: HTML output, and forwarding is blocked.
        return { text: formatInvitation(created), html: true };
      },
    });

    bot.command("invite", async (ctx) => {
      if (!(await ownerGate(ctx, deps))) return;
      await startFlow(ctx, "inv");
    });

    bot.command("invites", async (ctx) => {
      if (!(await ownerGate(ctx, deps))) return;
      await showList(ctx, deps, false);
    });

    bot.callbackQuery("open:invitations", async (ctx) => {
      await ack(ctx);
      if (!(await ownerGate(ctx, deps))) return;
      await showMenu(ctx, true);
    });

    bot.callbackQuery("inv:new", async (ctx) => {
      await ack(ctx);
      if (!(await ownerGate(ctx, deps))) return;
      await startFlow(ctx, "inv", true);
    });

    bot.callbackQuery("inv:list", async (ctx) => {
      await ack(ctx);
      if (!(await ownerGate(ctx, deps))) return;
      await showList(ctx, deps, true);
    });

    bot.callbackQuery(/^inv:show:\d+$/, async (ctx) => {
      await ack(ctx);
      if (!(await ownerGate(ctx, deps))) return;

      const id = Number(ctx.callbackQuery.data.split(":")[2]);

      const listOnly = new InlineKeyboard()
        .text("📋 Daftar undangan", "inv:list")
        .text(`${ICON.home} Home`, "nav:home");

      try {
        const { data } = await deps.api.showInvitation({
          telegramUserId: ctx.from.id,
          invitationId: id,
        });

        const keyboard = new InlineKeyboard();

        if (data.status === "pending") {
          keyboard.text(`🗑 Cabut #${id}`, `inv:revoke:${id}`).row();
        }

        keyboard
          .text("📋 Daftar undangan", "inv:list")
          .text(`${ICON.home} Home`, "nav:home");

        await show(ctx, formatInvitationDetail(data), keyboard, {
          edit: true,
          html: true,
        });
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          await show(
            ctx,
            "Xibra sedang tidak bisa dihubungi. Coba lagi sebentar lagi.",
            listOnly,
            { edit: true },
          );
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          await show(ctx, `Undangan #${id} tidak ditemukan.`, listOnly, {
            edit: true,
          });
          return;
        }

        // Anything else is unexpected: let the global handler log it.
        throw error;
      }
    });

    bot.callbackQuery(/^inv:revoke:\d+$/, async (ctx) => {
      await ack(ctx);
      if (!(await ownerGate(ctx, deps))) return;

      const id = Number(ctx.callbackQuery.data.split(":")[2]);

      const back = new InlineKeyboard()
        .text(`${ICON.invite} Menu undangan`, "open:invitations")
        .text(`${ICON.home} Home`, "nav:home");

      try {
        await deps.api.revokeInvitation({
          telegramUserId: ctx.from.id,
          invitationId: id,
        });
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          await show(
            ctx,
            "Xibra sedang tidak bisa dihubungi. Coba lagi sebentar lagi.",
            back,
            { edit: true },
          );
          return;
        }

        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 409)
        ) {
          await show(
            ctx,
            `Undangan #${id} tidak bisa dicabut. Mungkin sudah dipakai, kedaluwarsa, atau sudah dicabut.`,
            back,
            { edit: true },
          );
          return;
        }

        // Anything else is unexpected: let the global handler log it.
        throw error;
      }

      await show(ctx, `Undangan #${id} sudah dicabut.`, back, { edit: true });
    });
  },
};
