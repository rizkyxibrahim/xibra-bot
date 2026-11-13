import { ApiError, ApiUnavailableError } from "../api/errors.js";
import type { Logger } from "../logger.js";

const GENERIC = "Something went wrong. Please try again later.";

const MESSAGES: Readonly<Record<string, string>> = {
  TELEGRAM_NOT_LINKED:
    "This Telegram account is not linked to a Xibra account yet. Use /link <code> to connect it.",
  ACCOUNT_INACTIVE:
    "Your Xibra account is deactivated. Contact the platform owner.",
  FORBIDDEN: "You do not have permission to do that.",
  TELEGRAM_LINK_CODE_INVALID: "That link code is not valid.",
  TELEGRAM_LINK_CODE_EXPIRED:
    "That link code has expired. Request a new one from your Xibra account.",
  TELEGRAM_LINK_CODE_CONSUMED:
    "That link code was already used. Request a new one.",
  TELEGRAM_ALREADY_LINKED:
    "Your Xibra account already has a linked Telegram account.",
  TELEGRAM_ACCOUNT_IN_USE:
    "This Telegram account is already linked to a Xibra account.",
  TELEGRAM_LINK_THROTTLED:
    "Too many failed attempts. Try again in a few minutes.",
  VALIDATION_ERROR:
    "That input is not valid. Use /help to see the expected format.",
  INVITATION_EXPIRATION_INVALID:
    "The expiration must be between 1 and 72 hours.",
};

/**
 * Turn any failure into a short, safe message for the user.
 * Internal details are logged, never sent to Telegram.
 */
export function describeError(error: unknown, logger: Logger): string {
  if (error instanceof ApiUnavailableError) {
    logger.warn("The API is unavailable.", { reason: error.message });

    return "Xibra is unreachable right now. Please try again in a moment.";
  }

  if (error instanceof ApiError) {
    if (error.code === "SERVICE_UNAUTHENTICATED") {
      logger.error(
        "The API rejected the bot credentials. Check the key id, the secret and the system clock.",
      );

      return "The bot is temporarily unavailable.";
    }

    if (error.code === "TOO_MANY_REQUESTS") {
      const retryAfter = error.meta?.["retry_after"];

      return typeof retryAfter === "number"
        ? `Too many requests. Please wait ${retryAfter} seconds and try again.`
        : "Too many requests. Please wait a moment and try again.";
    }

    const known = MESSAGES[error.code];

    if (known !== undefined) {
      return known;
    }

    logger.warn("Unmapped API error.", {
      status: error.status,
      code: error.code,
    });

    return GENERIC;
  }

  logger.error("Unexpected error.", {
    error: error instanceof Error ? error.message : "unknown",
  });

  return GENERIC;
}
