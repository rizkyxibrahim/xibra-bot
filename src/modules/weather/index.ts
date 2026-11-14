import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";
import { ApiError, ApiUnavailableError } from "../../api/errors.js";
import { guard } from "../../core/guard.js";
import { loadLinkedAccount, UNLINKED_MESSAGE } from "../../core/linked.js";
import { ack, homeOnly, ICON, show } from "../../core/ui.js";
import type { BotModule, ModuleDeps } from "../types.js";
import { formatForecast } from "./format.js";

function weatherKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${ICON.refresh} Segarkan`, "weather:refresh")
    .text("📍 Hapus lokasi", "weather:delete")
    .row()
    .text(`${ICON.home} Home`, "nav:home");
}

async function requestLocation(ctx: Context, edit = false): Promise<void> {
  const prompt =
    "Bagikan lokasi melalui tombol di bawah agar Xibra dapat menampilkan cuaca di sekitar kamu.";

  // A reply keyboard cannot be attached to an edited message, so when the
  // button message is edited the prompt goes out as a separate message.
  if (edit && ctx.callbackQuery) {
    await show(ctx, "📍 Lokasi belum tersimpan.", homeOnly(), { edit: true });
    await ctx.reply(prompt, { reply_markup: locationKeyboard() });
    return;
  }

  await ctx.reply(`📍 Lokasi belum tersimpan.\n\n${prompt}`, {
    reply_markup: locationKeyboard(),
  });
}

function locationKeyboard(): Keyboard {
  return new Keyboard()
    .requestLocation("📍 Bagikan Lokasi")
    .row()
    .text("Batal")
    .resized()
    .oneTime();
}

async function showForecast(
  ctx: Context,
  deps: ModuleDeps,
  edit: boolean,
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId === undefined) return;

  try {
    const { data } = await deps.api.getWeather(telegramUserId);

    await show(ctx, formatForecast(data), weatherKeyboard(), { edit });
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      await show(
        ctx,
        "Xibra API sedang tidak bisa dihubungi. Coba lagi sebentar.",
        weatherKeyboard(),
        { edit },
      );
      return;
    }

    if (error instanceof ApiError && error.code === "BOT_LOCATION_REQUIRED") {
      await requestLocation(ctx, edit);
      return;
    }

    throw error;
  }
}

async function openWeather(
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

  const { data: location } = await deps.api.showLocation(telegramUserId);

  if (!location) {
    await requestLocation(ctx, edit);
    return;
  }

  await showForecast(ctx, deps, edit);
}

export const weather: BotModule = {
  id: "weather",
  title: "Cuaca",
  icon: "🌤️",
  help: [
    {
      command: "/cuaca",
      description: "Lihat cuaca dan prakiraan hari ini",
    },
  ],

  register(bot: Bot, deps: ModuleDeps): void {
    bot.command(
      "cuaca",
      guard(deps, (ctx) => openWeather(ctx, deps, false)),
    );

    bot.callbackQuery(
      "open:weather",
      guard(deps, async (ctx) => {
        await ack(ctx);
        await openWeather(ctx, deps, true);
      }),
    );

    bot.callbackQuery(
      "weather:refresh",
      guard(deps, async (ctx) => {
        await ack(ctx);
        await showForecast(ctx, deps, true);
      }),
    );

    bot.callbackQuery(
      "weather:delete",
      guard(deps, async (ctx) => {
        await ack(ctx);

        const telegramUserId = ctx.from?.id;
        if (telegramUserId === undefined) return;

        await deps.api.deleteLocation(telegramUserId);

        await show(
          ctx,
          "📍 Lokasi tersimpan sudah dihapus.",
          new InlineKeyboard()
            .text("📍 Bagikan lokasi baru", "open:weather")
            .row()
            .text(`${ICON.home} Home`, "nav:home"),
          { edit: true },
        );
      }),
    );

    bot.hears("Batal", async (ctx) => {
      await ctx.reply("Permintaan lokasi dibatalkan.", {
        reply_markup: { remove_keyboard: true },
      });
    });

    bot.on(
      "message:location",
      guard(deps, async (ctx) => {
        const telegramUserId = ctx.from?.id;
        const location = ctx.message?.location;
        if (telegramUserId === undefined || location === undefined) return;

        const account = await loadLinkedAccount(deps.api, telegramUserId);

        if (!account) {
          await ctx.reply(UNLINKED_MESSAGE, {
            reply_markup: { remove_keyboard: true },
          });
          return;
        }

        await deps.api.saveLocation({
          telegramUserId,
          latitude: location.latitude,
          longitude: location.longitude,
        });

        await ctx.reply("📍 Lokasi berhasil disimpan.", {
          reply_markup: { remove_keyboard: true },
        });

        await showForecast(ctx, deps, false);
      }),
    );
  },
};
