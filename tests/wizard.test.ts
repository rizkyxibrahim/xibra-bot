import { InlineKeyboard, type Bot } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { ICON } from "../src/core/ui.js";
import {
  registerFlow,
  registerWizard,
  startFlow,
  type WizardData,
  type WizardFlow,
} from "../src/core/wizard.js";

type Handler = (ctx: any, next?: () => Promise<void>) => Promise<void> | void;

type Captured = { text: string; payload: any };

type View = { replies: Captured[]; edits: Captured[] };

let lastUserId = 9000;

function newUserId(): number {
  lastUserId += 1;
  return lastUserId;
}

function buildFlow(overrides: Partial<WizardFlow> = {}): WizardFlow {
  return {
    id: "test",
    title: "Test flow",
    steps: [
      {
        key: "kind",
        prompt: () => "Pick a kind",
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
        accept: (input) =>
          input === "one" || input === "two"
            ? { ok: true, value: input }
            : { ok: false, message: "Pick one or two." },
      },
      {
        key: "note",
        prompt: () => "Add a note",
        freeText: true,
        optional: true,
        accept: (input) => ({ ok: true, value: input }),
      },
    ],
    finish: async (data) => ({ text: `done:${data.kind}:${data.note ?? ""}` }),
    ...overrides,
  };
}

function createHarness() {
  const commands = new Map<string, Handler>();
  const callbacks: Array<{ pattern: RegExp; handler: Handler }> = [];
  let textHandler: Handler | undefined;

  const bot = {
    command(triggers: string | string[], handler: Handler) {
      for (const trigger of Array.isArray(triggers) ? triggers : [triggers]) {
        commands.set(trigger, handler);
      }
    },
    callbackQuery(pattern: RegExp, handler: Handler) {
      callbacks.push({ pattern, handler });
    },
    on(event: string, handler: Handler) {
      if (event === "message:text") textHandler = handler;
    },
  } as unknown as Bot;

  registerWizard(bot);

  function context(userId: number, callbackData?: string) {
    const replies: Captured[] = [];
    const edits: Captured[] = [];

    const ctx = {
      from: { id: userId },
      callbackQuery:
        callbackData === undefined ? undefined : { data: callbackData },
      reply: async (text: string, payload: any) => {
        replies.push({ text, payload });
      },
      editMessageText: async (text: string, payload: any) => {
        edits.push({ text, payload });
      },
      answerCallbackQuery: async () => undefined,
    };

    return { ctx: ctx as any, replies, edits };
  }

  return {
    async start(userId: number, flowId: string): Promise<View> {
      const view = context(userId);
      await startFlow(view.ctx, flowId);
      return view;
    },
    async press(userId: number, data: string): Promise<View> {
      const entry = callbacks.find((candidate) => candidate.pattern.test(data));

      if (!entry) throw new Error(`No callback handler for "${data}".`);

      const view = context(userId, data);
      await entry.handler(view.ctx);
      return view;
    },
    async type(
      userId: number,
      text: string,
    ): Promise<View & { next: ReturnType<typeof vi.fn> }> {
      const handler = textHandler;

      if (!handler) throw new Error("No text handler registered.");

      const view = context(userId);
      const next = vi.fn(async () => undefined);

      await handler({ ...view.ctx, message: { text } }, next);

      return { ...view, next };
    },
    async command(name: string, userId: number): Promise<View> {
      const handler = commands.get(name);

      if (!handler) throw new Error(`No command handler for "${name}".`);

      const view = context(userId);
      await handler(view.ctx);
      return view;
    },
    hasCallbackHandler(data: string): boolean {
      return callbacks.some((candidate) => candidate.pattern.test(data));
    },
  };
}

function labels(payload: any): string[] {
  const markup: unknown = payload?.reply_markup;

  if (!(markup instanceof InlineKeyboard)) return [];

  return markup.inline_keyboard.flat().map((button) => button.text);
}

function callbackData(payload: any): string[] {
  const markup: unknown = payload?.reply_markup;

  if (!(markup instanceof InlineKeyboard)) return [];

  return markup.inline_keyboard
    .flat()
    .map((button) =>
      "callback_data" in button ? (button.callback_data ?? "") : "",
    );
}

describe("wizard", () => {
  it("renders the first step with options and navigation buttons", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const view = await harness.start(newUserId(), "test");
    const reply = view.replies[0];

    expect(reply?.text).toContain("langkah 1 dari 2");
    expect(reply?.text).toContain("Pick a kind");
    expect(labels(reply?.payload)).toEqual([
      "One",
      "Two",
      `${ICON.cancel} Batal`,
      `${ICON.home} Home`,
    ]);
    expect(callbackData(reply?.payload)).toEqual([
      "wz:test:0:one",
      "wz:test:0:two",
      "wz:cancel",
      "nav:home",
    ]);
  });

  it("advances to the next step when an option is pressed", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.press(userId, "wz:test:0:one");
    const edit = view.edits[0];

    expect(edit?.text).toContain("langkah 2 dari 2");
    expect(edit?.text).toContain("Ketik jawabanmu");
    expect(labels(edit?.payload).join(" ")).toContain("Lewati");
    expect(labels(edit?.payload)).toContain(`${ICON.back} Kembali`);
  });

  it("goes back one step with Kembali", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");
    await harness.press(userId, "wz:test:0:one");

    const view = await harness.press(userId, "wz:back");

    expect(view.edits[0]?.text).toContain("langkah 1 dari 2");
    expect(labels(view.edits[0]?.payload)).not.toContain(
      `${ICON.back} Kembali`,
    );
  });

  it("stays on the first step when Kembali is pressed there", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.press(userId, "wz:back");

    expect(view.edits[0]?.text).toContain("langkah 1 dari 2");
    expect(labels(view.edits[0]?.payload)).not.toContain(
      `${ICON.back} Kembali`,
    );
  });

  it("reports an ended session when Kembali is pressed without a flow", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const view = await harness.press(newUserId(), "wz:back");

    expect(view.edits[0]?.text).toBe(
      "Sesi ini sudah berakhir. Mulai lagi dari menu.",
    );
  });

  it("keeps sessions isolated between users", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const first = newUserId();
    const second = newUserId();
    await harness.start(first, "test");
    await harness.start(second, "test");

    // The first user advances to step 2.
    await harness.press(first, "wz:test:0:one");

    // The second user is still on step 1, so a step 2 button is stale.
    const stale = await harness.press(second, "wz:test:1:");
    expect(stale.edits[0]?.text).toBe(
      "Tombol ini sudah tidak berlaku. Mulai lagi dari menu.",
    );

    // Cancelling the first session does not end the second one.
    await harness.press(first, "wz:cancel");
    const next = await harness.press(second, "wz:test:0:two");
    expect(next.edits[0]?.text).toContain("langkah 2 dari 2");
  });

  it("cancels the session with the Batal button", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const cancel = await harness.press(userId, "wz:cancel");
    expect(cancel.edits[0]?.text).toBe("Dibatalkan.");

    const after = await harness.press(userId, "wz:test:0:one");
    expect(after.edits[0]?.text).toBe(
      "Sesi ini sudah berakhir. Mulai lagi dari menu.",
    );
  });

  it("cancels the session with the /batal command", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const cancel = await harness.command("batal", userId);
    expect(cancel.replies[0]?.text).toContain("Dibatalkan");

    const after = await harness.press(userId, "wz:test:0:one");
    expect(after.edits[0]?.text).toContain("Sesi ini sudah berakhir");
  });

  it("rejects a button from a step that is no longer active", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.press(userId, "wz:test:1:one");

    expect(view.edits[0]?.text).toBe(
      "Tombol ini sudah tidak berlaku. Mulai lagi dari menu.",
    );
  });

  it("rejects a button that belongs to another flow", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.press(userId, "wz:other:0:one");

    expect(view.edits[0]?.text).toBe(
      "Tombol ini sudah tidak berlaku. Mulai lagi dari menu.",
    );
  });

  it("rejects typed answers on a button-only step", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.type(userId, "hello");

    expect(view.replies[0]?.text).toBe(
      "Pilih salah satu tombol di atas, atau ketik /batal untuk berhenti.",
    );
    expect(view.next).not.toHaveBeenCalled();

    // The rejected answer must not advance the flow.
    const next = await harness.press(userId, "wz:test:0:two");
    expect(next.edits[0]?.text).toContain("langkah 2 dari 2");
  });

  it("accepts typed answers on a free-text step", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");
    await harness.press(userId, "wz:test:0:one");

    const view = await harness.type(userId, "catatan");

    expect(view.replies[0]?.text).toBe("done:one:catatan");
    expect(labels(view.replies[0]?.payload)).toEqual([`${ICON.home} Home`]);
  });

  it("treats the skip button as an empty answer", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");
    await harness.press(userId, "wz:test:0:one");

    const view = await harness.press(userId, "wz:test:1:");

    expect(view.edits[0]?.text).toBe("done:one:");
  });

  it("keeps the step when the answer is rejected", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.press(userId, "wz:test:0:three");

    expect(view.replies[0]?.text).toBe("Pick one or two.");
    expect(view.replies[1]?.text).toContain("langkah 1 dari 2");
    expect(view.edits).toHaveLength(0);
  });

  it("passes the answers to finish in step order", async () => {
    const harness = createHarness();
    const finish = vi.fn(async (data: WizardData) => ({
      text: `done:${data.kind}:${data.note ?? ""}`,
    }));
    registerFlow(buildFlow({ finish }));

    const userId = newUserId();
    await harness.start(userId, "test");
    await harness.press(userId, "wz:test:0:one");
    await harness.type(userId, "catatan");

    expect(finish).toHaveBeenCalledWith(
      { kind: "one", note: "catatan" },
      expect.anything(),
    );
  });

  it("reports a failing finish and ends the session", async () => {
    const harness = createHarness();
    registerFlow(
      buildFlow({
        finish: async () => {
          throw new Error("boom");
        },
      }),
    );

    const userId = newUserId();
    await harness.start(userId, "test");
    await harness.press(userId, "wz:test:0:one");

    const view = await harness.press(userId, "wz:test:1:");
    expect(view.edits[0]?.text).toBe(
      "Langkah ini gagal diselesaikan. Coba lagi dari menu.",
    );

    const after = await harness.press(userId, "wz:test:0:one");
    expect(after.edits[0]?.text).toContain("Sesi ini sudah berakhir");
  });

  it("lets commands through while a flow is active", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");

    const view = await harness.type(userId, "/start");

    expect(view.next).toHaveBeenCalledTimes(1);
    expect(view.replies).toHaveLength(0);
  });

  it("restarts a flow from the first step", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const userId = newUserId();
    await harness.start(userId, "test");
    await harness.press(userId, "wz:test:0:one");

    const view = await harness.start(userId, "test");

    expect(view.replies[0]?.text).toContain("langkah 1 dari 2");
    expect(labels(view.replies[0]?.payload)).not.toContain(
      `${ICON.back} Kembali`,
    );
  });

  it("ignores an unknown flow id", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    const view = await harness.start(newUserId(), "missing");

    expect(view.replies).toHaveLength(0);
  });

  it("leaves the Home button to the home module", async () => {
    const harness = createHarness();
    registerFlow(buildFlow());

    expect(harness.hasCallbackHandler("nav:home")).toBe(false);

    const view = await harness.start(newUserId(), "test");
    expect(labels(view.replies[0]?.payload)).toContain(`${ICON.home} Home`);
  });
});
