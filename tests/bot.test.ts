import { describe, expect, it } from "vitest";
import { ApiError, ApiUnavailableError } from "../src/api/errors.js";
import type { InvitationData } from "../src/api/types.js";
import { describeError } from "../src/bot/errors.js";
import {
  escapeHtml,
  formatInvitation,
  parseInviteArgs,
} from "../src/bot/format.js";

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("parseInviteArgs", () => {
  it("returns nothing for empty input", () => {
    expect(parseInviteArgs("")).toEqual({});
    expect(parseInviteArgs("   ")).toEqual({});
  });

  it("reads a leading integer as hours", () => {
    expect(parseInviteArgs("48")).toEqual({ hours: 48 });
  });

  it("treats the rest as the note", () => {
    expect(parseInviteArgs("24 For a  friend")).toEqual({
      hours: 24,
      note: "For a friend",
    });
  });

  it("treats text without a leading integer as the note", () => {
    expect(parseInviteArgs("For a friend 24")).toEqual({
      note: "For a friend 24",
    });
  });
});

describe("formatInvitation", () => {
  const data: InvitationData = {
    invitation: { expires_at: "2026-11-14T10:00:00+00:00" },
    secrets: {
      code: "XIBRA-5JG1-DCRJ",
      token: "raw-token-must-not-appear",
      link: "https://app.example.test/invite?a=1&b=2",
    },
  };

  it("shows the code, the escaped link and the expiry", () => {
    const text = formatInvitation(data);

    expect(text).toContain("<code>XIBRA-5JG1-DCRJ</code>");
    expect(text).toContain("https://app.example.test/invite?a=1&amp;b=2");
    expect(text).toContain("Expires: 2026-11-14T10:00:00+00:00");
  });

  it("never shows the raw token", () => {
    expect(formatInvitation(data)).not.toContain("raw-token-must-not-appear");
  });

  it("omits the link when none is configured", () => {
    const text = formatInvitation({
      ...data,
      secrets: { ...data.secrets, link: null },
    });

    expect(text).not.toContain("Link:");
  });

  it("escapes markup", () => {
    expect(escapeHtml("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });
});

describe("describeError", () => {
  it("maps known API codes", () => {
    const error = new ApiError(
      404,
      "TELEGRAM_NOT_LINKED",
      "No Telegram account is linked.",
    );

    expect(describeError(error, logger)).toContain("/link");
  });

  it("hides credential problems from the user", () => {
    const error = new ApiError(
      401,
      "SERVICE_UNAUTHENTICATED",
      "Service authentication failed.",
    );

    expect(describeError(error, logger)).toBe(
      "The bot is temporarily unavailable.",
    );
  });

  it("includes the retry delay when the API provides it", () => {
    const error = new ApiError(429, "TOO_MANY_REQUESTS", "Too many requests.", {
      retry_after: 30,
    });

    expect(describeError(error, logger)).toContain("30 seconds");
  });

  it("reports an unreachable API", () => {
    expect(describeError(new ApiUnavailableError("down"), logger)).toContain(
      "unreachable",
    );
  });

  it("falls back to a generic message for unknown failures", () => {
    expect(describeError(new Error("secret internals"), logger)).not.toContain(
      "secret internals",
    );
    expect(describeError(new ApiError(500, "WHATEVER", "x"), logger)).toContain(
      "Something went wrong",
    );
  });
});
