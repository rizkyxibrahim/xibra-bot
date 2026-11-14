import type { XibraApiClient } from "../api/client.js";
import type { AccountData } from "../api/types.js";

export const UNLINKED_MESSAGE =
  "Akun Telegram ini belum tertaut.\n\n" +
  "1. Buka dashboard Xibra, menu Account, lalu buat kode.\n" +
  "2. Kirim /link <kode> ke sini dalam 10 menit.";

/**
 * Assumes the API error carries its envelope code on `code`. If the client
 * uses a different shape, adjust this one function.
 */
export function isNotLinked(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "TELEGRAM_NOT_LINKED"
  );
}

/** The linked account, or null when the Telegram account is not linked. */
export async function loadLinkedAccount(
  api: XibraApiClient,
  telegramUserId: number,
): Promise<AccountData | null> {
  try {
    const { data } = await api.getAccount(telegramUserId);
    return data;
  } catch (error) {
    if (isNotLinked(error)) return null;
    throw error;
  }
}

export function isOwner(account: AccountData): boolean {
  return (account.roles ?? []).some((role) => role.label === "Owner");
}
