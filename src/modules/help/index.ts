import type { Bot } from "grammy";
import { homeOnly, ack, show } from "../../core/ui.js";
import type { BotModule } from "../types.js";

function helpText(modules: BotModule[]): string {
  const lines = [
    "Cara memakai bot ini",
    "",
    "• Klik tombol untuk memilih.",
    "• Kalau diminta, kamu juga bisa mengetik jawaban sendiri.",
    "• Kembali dan Home selalu tersedia. /batal berhenti di tengah langkah.",
    "• Fitur hanya tersedia setelah akunmu tertaut dengan /link.",
    "",
    "Perintah umum:",
    "/start - menu utama",
    "/menu - sama dengan /start",
    "/help - bantuan ini",
    "/batal - batalkan langkah yang sedang berjalan",
  ];

  for (const module of modules) {
    const entries = module.help.filter((entry) => entry.command);
    if (entries.length === 0) continue;

    lines.push("", `${module.icon} ${module.title}`);

    for (const entry of entries) {
      lines.push(`${entry.command} - ${entry.description}`);
    }
  }

  return lines.join("\n");
}

export function registerHelp(bot: Bot, modules: BotModule[]): void {
  bot.command("help", (ctx) => show(ctx, helpText(modules), homeOnly()));

  bot.callbackQuery("nav:help", async (ctx) => {
    await ack(ctx);
    await show(ctx, helpText(modules), homeOnly(), { edit: true });
  });
}
