import type { InvitationData } from "../api/types.js";
import type { InvitationDetail, PersonRef } from "../api/client.js";

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

export const STATUS_LABELS: Record<string, string> = {
  pending: "menunggu",
  redeemed: "sudah dipakai",
  expired: "kedaluwarsa",
  revoked: "dicabut",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Formats an ISO timestamp as Asia/Jakarta time, for example "15 Nov 2026, 12:14 WIB". */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return "-";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  // Asia/Jakarta is a fixed UTC+7 with no daylight saving.
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number): string => String(value).padStart(2, "0");

  return (
    `${wib.getUTCDate()} ${MONTHS[wib.getUTCMonth()] ?? ""} ${wib.getUTCFullYear()}, ` +
    `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())} WIB`
  );
}

function person(user: PersonRef | null | undefined): string {
  if (!user) return "-";

  return `${escapeHtml(user.name)} (@${escapeHtml(user.username)})`;
}

/** HTML detail screen for one invitation. Secrets are never part of it. */
export function formatInvitationDetail(item: InvitationDetail): string {
  const lines = [
    `Undangan #${item.id}`,
    "",
    `Status: ${STATUS_LABELS[item.status] ?? item.status}`,
    `Peran: ${escapeHtml(item.role?.label ?? "-")}`,
  ];

  if (item.note) {
    lines.push(`Catatan: ${escapeHtml(item.note)}`);
  }

  lines.push(
    `Dibuat oleh: ${person(item.created_by)}`,
    `Dibuat: ${formatWib(item.created_at)}`,
    `Berlaku sampai: ${formatWib(item.expires_at)}`,
  );

  if (item.redeemed_by || item.redeemed_at) {
    lines.push(
      `Dipakai oleh: ${person(item.redeemed_by)}`,
      `Dipakai pada: ${formatWib(item.redeemed_at)}`,
    );
  }

  if (item.revoked_by || item.revoked_at) {
    lines.push(
      `Dicabut oleh: ${person(item.revoked_by)}`,
      `Dicabut pada: ${formatWib(item.revoked_at)}`,
    );
  }

  if (item.status === "pending") {
    lines.push(
      "",
      "Kode dan link tidak bisa ditampilkan lagi. Jika hilang, cabut undangan ini lalu buat yang baru.",
    );
  }

  return lines.join("\n");
}
