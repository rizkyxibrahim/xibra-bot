import { InlineKeyboard, type Bot, type Context } from "grammy";
import { ICON, homeOnly, show } from "./ui.js";

export type WizardData = Record<string, string>;

export interface WizardOption {
  label: string;
  value: string;
}

export type StepResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export interface WizardStep {
  /** Key under which the answer is stored in WizardData. */
  key: string;
  prompt: (data: WizardData) => string;
  options?: WizardOption[];
  /** The user may type the answer instead of tapping. */
  freeText?: boolean;
  /** Shows a Lewati (skip) button. The answer is an empty string. */
  optional?: boolean;
  accept: (input: string, data: WizardData) => StepResult | Promise<StepResult>;
}

export interface WizardResult {
  text: string;
  html?: boolean;
  protect?: boolean;
}

export interface WizardFlow {
  id: string;
  title: string;
  steps: WizardStep[];
  finish: (data: WizardData, ctx: Context) => Promise<WizardResult>;
}

interface Session {
  flow: WizardFlow;
  index: number;
  data: WizardData;
}

const flows = new Map<string, WizardFlow>();
const sessions = new Map<number, Session>();

/**
 * Index access returns `T | undefined` under noUncheckedIndexedAccess.
 * A missing step is a programming error, so it fails loudly here.
 */
function stepAt(flow: WizardFlow, index: number): WizardStep {
  const step = flow.steps[index];

  if (!step) {
    throw new Error(`Wizard ${flow.id} has no step ${index}.`);
  }

  return step;
}

export function registerFlow(flow: WizardFlow): void {
  flows.set(flow.id, flow);
}

function render(session: Session): { text: string; keyboard: InlineKeyboard } {
  const { flow, index, data } = session;
  const step = stepAt(flow, index);
  const keyboard = new InlineKeyboard();

  for (const option of step.options ?? []) {
    keyboard.text(option.label, `wz:${flow.id}:${index}:${option.value}`).row();
  }

  if (step.optional) {
    keyboard.text("⏭ Lewati", `wz:${flow.id}:${index}:`).row();
  }

  if (index > 0) {
    keyboard.text(`${ICON.back} Kembali`, "wz:back");
  }

  keyboard
    .text(`${ICON.cancel} Batal`, "wz:cancel")
    .text(`${ICON.home} Home`, "nav:home");

  const hint = step.freeText
    ? "\n\nKetik jawabanmu, atau pilih tombol di bawah."
    : "";

  const text =
    `${flow.title} · langkah ${index + 1} dari ${flow.steps.length}\n\n` +
    `${step.prompt(data)}${hint}`;

  return { text, keyboard };
}

async function advance(
  ctx: Context,
  userId: number,
  input: string,
  edit: boolean,
): Promise<void> {
  const session = sessions.get(userId);
  if (!session) return;

  const step = stepAt(session.flow, session.index);
  const result = await step.accept(input, session.data);

  if (!result.ok) {
    await ctx.reply(result.message);
    const view = render(session);
    await show(ctx, view.text, view.keyboard, { edit: false });
    return;
  }

  session.data[step.key] = result.value;

  if (session.index + 1 < session.flow.steps.length) {
    session.index += 1;
    const view = render(session);
    await show(ctx, view.text, view.keyboard, { edit });
    return;
  }

  sessions.delete(userId);

  try {
    const done = await session.flow.finish(session.data, ctx);
    await show(ctx, done.text, homeOnly(), {
      edit,
      html: done.html,
      protect: done.protect,
    });
  } catch {
    await show(
      ctx,
      "Langkah ini gagal diselesaikan. Coba lagi dari menu.",
      homeOnly(),
      { edit },
    );
  }
}

/** Starts a flow for the sender, replacing any flow already in progress. */
export async function startFlow(
  ctx: Context,
  flowId: string,
  edit = false,
): Promise<void> {
  const userId = ctx.from?.id;
  const flow = flows.get(flowId);
  if (userId === undefined || !flow) return;

  const session: Session = { flow, index: 0, data: {} };
  sessions.set(userId, session);

  const view = render(session);
  await show(ctx, view.text, view.keyboard, { edit });
}

export function registerWizard(bot: Bot): void {
  bot.command(["batal", "cancel"], async (ctx) => {
    if (ctx.from) sessions.delete(ctx.from.id);
    await show(
      ctx,
      "Dibatalkan. Ketik /start untuk kembali ke menu.",
      homeOnly(),
    );
  });

  bot.callbackQuery(/^wz:/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);

    const userId = ctx.from.id;
    const data = ctx.callbackQuery.data;
    const session = sessions.get(userId);

    if (data === "wz:cancel") {
      sessions.delete(userId);
      await show(ctx, "Dibatalkan.", homeOnly(), { edit: true });
      return;
    }

    if (!session) {
      await show(
        ctx,
        "Sesi ini sudah berakhir. Mulai lagi dari menu.",
        homeOnly(),
        { edit: true },
      );
      return;
    }

    if (data === "wz:back") {
      if (session.index > 0) session.index -= 1;
      const view = render(session);
      await show(ctx, view.text, view.keyboard, { edit: true });
      return;
    }

    // Format: wz:<flowId>:<stepIndex>:<value>. A stale button fails the check.
    const [, flowId, indexRaw = "", ...rest] = data.split(":");

    if (flowId !== session.flow.id || indexRaw !== String(session.index)) {
      await show(
        ctx,
        "Tombol ini sudah tidak berlaku. Mulai lagi dari menu.",
        homeOnly(),
        { edit: true },
      );
      return;
    }

    await advance(ctx, userId, rest.join(":"), true);
  });

  // Typed answers. Commands always pass through to their own handlers.
  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from?.id;
    const text = ctx.message.text.trim();
    const session = userId === undefined ? undefined : sessions.get(userId);

    if (userId === undefined || !session || text.startsWith("/")) {
      await next();
      return;
    }

    const step = stepAt(session.flow, session.index);

    if (!step.freeText) {
      await ctx.reply(
        "Pilih salah satu tombol di atas, atau ketik /batal untuk berhenti.",
      );
      return;
    }

    await advance(ctx, userId, text, false);
  });
}
