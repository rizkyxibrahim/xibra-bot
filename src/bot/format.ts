import type { InvitationData } from "../api/types.js";

export const MAX_NOTE_LENGTH = 255;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parse "/invite [hours] [note...]". A leading integer is the lifetime in
 * hours; everything else is the note.
 */
export function parseInviteArgs(input: string): {
  hours?: number;
  note?: string;
} {
  const trimmed = input.trim();

  if (trimmed === "") {
    return {};
  }

  const [first = "", ...rest] = trimmed.split(/\s+/);

  if (/^\d+$/.test(first)) {
    const hours = Number.parseInt(first, 10);
    const note = rest.join(" ");

    return note === "" ? { hours } : { hours, note };
  }

  return { note: trimmed };
}

/**
 * HTML message for a freshly created invitation. The raw token is never
 * shown; the code (and the link when configured) is enough to redeem it.
 */
export function formatInvitation(data: InvitationData): string {
  const lines = [
    "Invitation created.",
    "",
    `Code: <code>${escapeHtml(data.secrets.code)}</code>`,
  ];

  const link = data.secrets.link;
  if (typeof link === "string" && link !== "") {
    lines.push(`Link: ${escapeHtml(link)}`);
  }

  const expiresAt = data.invitation["expires_at"];
  if (typeof expiresAt === "string" && expiresAt !== "") {
    lines.push(`Expires: ${escapeHtml(expiresAt)}`);
  }

  lines.push("", "Share it privately. It will not be shown again.");

  return lines.join("\n");
}
