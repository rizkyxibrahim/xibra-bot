import { InlineKeyboard, type Bot, type Context } from "grammy";
import { ApiUnavailableError } from "../../api/errors.js";
import { escapeHtml } from "../../bot/format.js";
import { loadLinkedAccount, UNLINKED_MESSAGE } from "../../core/linked.js";
import { ack, homeOnly, ICON, show } from "../../core/ui.js";
import type { BotModule, ModuleDeps } from "../types.js";
import { guard } from "../../core/guard.js";

function categoryKeyboard(
  categories: { key: string; label: string }[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (let index = 0; index < categories.length; index += 2) {
    const first = categories[index];
    const second = categories[index + 1];

    if (!first) continue;

    keyboard.text(first.label, `news:category:${first.key}`);

    if (second) {
      keyboard.text(second.label, `news:category:${second.key}`);
    }

    keyboard.row();
  }
  return keyboard.text(`${ICON.home} Home`, "nav:home");
}

async function showCategories(
  ctx: Context,
  deps: ModuleDeps,
  edit: boolean,
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId === undefined) return;

  try {
    const { data: categories } =
      await deps.api.getNewsCategories(telegramUserId);

    if (categories.length === 0) {
      await show(ctx, "Belum ada kategori berita yang tersedia.", homeOnly(), {
        edit,
      });
      return;
    }

    await show(
      ctx,
      "📰 Berita\n\nPilih kategori berita yang ingin kamu baca:",
      categoryKeyboard(categories),
      { edit },
    );
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      await show(
        ctx,
        "Xibra API sedang tidak bisa dihubungi. Coba lagi sebentar.",
        homeOnly(),
        { edit },
      );
      return;
    }

    throw error;
  }
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function showHeadlines(
  ctx: Context,
  deps: ModuleDeps,
  category: string,
  edit: boolean,
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId === undefined) return;

  try {
    const { data: categories } =
      await deps.api.getNewsCategories(telegramUserId);

    const selected = categories.find((item) => item.key === category);

    if (!selected) {
      await showCategories(ctx, deps, edit);
      return;
    }

    const { data: headlines } = await deps.api.getNewsHeadlines({
      telegramUserId,
      category,
    });

    if (headlines.length === 0) {
      await show(
        ctx,
        `📰 ${escapeHtml(selected.label)}\n\nBelum ada berita yang tersedia.`,
        new InlineKeyboard()
          .text(`${ICON.back} Kategori`, "news:categories")
          .text(`${ICON.home} Home`, "nav:home"),
        { edit, html: true },
      );
      return;
    }

    const lines = headlines.map((item, index) => {
      const publishedAt = formatPublishedAt(item.published_at);
      const dateLine = publishedAt ? `\n   🕒 ${publishedAt}` : "";

      return `${index + 1}. ${escapeHtml(item.title)}${dateLine}`;
    });

    const keyboard = new InlineKeyboard();

    for (let index = 0; index < headlines.length; index++) {
      const item = headlines[index];

      if (!item) continue;

      const label =
        item.title.length > 42 ? `${item.title.slice(0, 39)}...` : item.title;

      keyboard.url(`🔗 ${index + 1}. ${label}`, item.link).row();
    }

    keyboard
      .text(`${ICON.refresh} Segarkan`, `news:refresh:${category}`)
      .row()
      .text(`${ICON.back} Kategori`, "news:categories")
      .text(`${ICON.home} Home`, "nav:home");

    await show(
      ctx,
      [
        `📰 <b>${escapeHtml(selected.label)}</b>`,
        "",
        ...lines,
        "",
        "<i>Pilih tautan di bawah untuk membaca berita lengkap.</i>",
      ].join("\n"),
      keyboard,
      { edit, html: true },
    );
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      await show(
        ctx,
        "Xibra API sedang tidak bisa dihubungi. Coba lagi sebentar.",
        new InlineKeyboard()
          .text(`${ICON.back} Kategori`, "news:categories")
          .text(`${ICON.home} Home`, "nav:home"),
        { edit },
      );
      return;
    }

    throw error;
  }
}

async function openNews(
  ctx: Context,
  deps: ModuleDeps,
  edit: boolean,
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId === undefined) return;

  const account = await loadLinkedAccount(deps.api, telegramUserId);

  if (!account) {
    await show(ctx, UNLINKED_MESSAGE, homeOnly(), { edit });
    return;
  }

  await showCategories(ctx, deps, edit);
}

export const news: BotModule = {
  id: "news",
  title: "Berita",
  icon: "📰",
  help: [
    {
      command: "/berita",
      description: "Baca berita terkini berdasarkan kategori",
    },
  ],

  register(bot: Bot, deps: ModuleDeps): void {
    bot.command(
      "berita",
      guard(deps, (ctx) => openNews(ctx, deps, false)),
    );

    bot.callbackQuery(
      "open:news",
      guard(deps, async (ctx) => {
        await ack(ctx);
        await openNews(ctx, deps, true);
      }),
    );

    bot.callbackQuery(
      "news:categories",
      guard(deps, async (ctx) => {
        await ack(ctx);
        await showCategories(ctx, deps, true);
      }),
    );

    bot.callbackQuery(
      /^news:category:[a-z0-9_-]+$/,
      guard(deps, async (ctx) => {
        await ack(ctx);

        const data = ctx.callbackQuery?.data ?? "";
        await showHeadlines(
          ctx,
          deps,
          data.slice("news:category:".length),
          true,
        );
      }),
    );

    bot.callbackQuery(
      /^news:refresh:[a-z0-9_-]+$/,
      guard(deps, async (ctx) => {
        await ack(ctx);

        const data = ctx.callbackQuery?.data ?? "";
        await showHeadlines(
          ctx,
          deps,
          data.slice("news:refresh:".length),
          true,
        );
      }),
    );
  },
};
