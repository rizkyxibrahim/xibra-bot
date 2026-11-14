import type { Bot, Context } from "grammy";
import { loadLinkedAccount, UNLINKED_MESSAGE } from "../core/linked.js";
import { homeOnly, ICON, show } from "../core/ui.js";
import type { BotModule, ModuleDeps } from "./types.js";

interface ComingSoonSpec {
  id: string;
  title: string;
  icon: string;
  command: string;
  description: string;
}

/** A placeholder module: it reserves the command and the button, nothing else. */
export function comingSoon(spec: ComingSoonSpec): BotModule {
  const screen =
    `${spec.icon} ${spec.title}\n\n${spec.description}\n\n` +
    `${ICON.soon} Fitur ini sedang dikerjakan dan segera hadir.`;

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

    await show(ctx, screen, homeOnly(), { edit });
  }

  return {
    id: spec.id,
    title: spec.title,
    icon: spec.icon,
    help: [
      {
        command: `/${spec.command}`,
        description: `${spec.description} (segera hadir)`,
      },
    ],
    register(bot: Bot, deps: ModuleDeps): void {
      bot.command(spec.command, (ctx) => open(ctx, deps, false));

      bot.callbackQuery(`open:${spec.id}`, async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => undefined);
        await open(ctx, deps, true);
      });
    },
  };
}
