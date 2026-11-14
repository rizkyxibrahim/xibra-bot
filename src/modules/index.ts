import { account } from "./account/index.js";
import { invitations } from "./invitations/index.js";
import { schedule } from "./schedule/index.js";
import { weather } from "./weather/index.js";
import { shifts } from "./shifts/index.js";
import { tasks } from "./tasks/index.js";
import { reminders } from "./reminders/index.js";
import { finance } from "./finance/index.js";
import { news } from "./news/index.js";
import type { BotModule } from "./types.js";

export const modules: BotModule[] = [
  account,
  invitations,
  schedule,
  weather,
  shifts,
  tasks,
  reminders,
  finance,
  news,
];

/** Entries for Telegram's command menu (setMyCommands). */
export function commandMenu(): Array<{ command: string; description: string }> {
  const commands = [
    { command: "start", description: "Menu utama" },
    { command: "menu", description: "Menu utama" },
    { command: "help", description: "Bantuan" },
    { command: "batal", description: "Batalkan langkah yang sedang berjalan" },
  ];

  for (const module of modules) {
    for (const entry of module.help) {
      if (entry.command) {
        commands.push({
          command: entry.command.replace(/^\//, ""),
          description: entry.description.slice(0, 256),
        });
      }
    }
  }

  return commands;
}
