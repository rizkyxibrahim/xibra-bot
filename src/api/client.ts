import { ApiError, ApiUnavailableError } from "./errors.js";
import { newNonce, sign } from "./signature.js";
import type {
  AccountData,
  ApiEnvelope,
  InvitationData,
  LinkData,
} from "./types.js";

export interface ApiClientOptions {
  baseUrl: string;
  keyId: string;
  secret: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  nonce?: () => string;
}

/**
 * Signed client for the trusted bot endpoints of xibra-api.
 *
 * Non-idempotent calls are never retried: a retry would need a new nonce
 * and could repeat an action such as creating an invitation.
 */
export class XibraApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly nonce: () => string;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.nonce = options.nonce ?? newNonce;
  }

  getAccount(telegramUserId: number): Promise<ApiEnvelope<AccountData>> {
    return this.post<AccountData>("/api/v1/bot/account", {
      telegram_user_id: telegramUserId,
    });
  }

  linkTelegram(input: {
    code: string;
    telegramUserId: number;
    telegramUsername?: string;
  }): Promise<ApiEnvelope<LinkData>> {
    return this.post<LinkData>("/api/v1/bot/telegram/link", {
      code: input.code,
      telegram_user_id: input.telegramUserId,
      ...(input.telegramUsername !== undefined
        ? { telegram_username: input.telegramUsername }
        : {}),
    });
  }

  createInvitation(input: {
    telegramUserId: number;
    expiresInHours?: number;
    note?: string;
  }): Promise<ApiEnvelope<InvitationData>> {
    return this.post<InvitationData>("/api/v1/bot/invitations", {
      telegram_user_id: input.telegramUserId,
      ...(input.expiresInHours !== undefined
        ? { expires_in_hours: input.expiresInHours }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
  }

  async post<T>(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<ApiEnvelope<T>> {
    const body = JSON.stringify(payload);
    const url = new URL(path, this.options.baseUrl);
    const timestamp = String(Math.floor(this.now() / 1000));
    const nonce = this.nonce();
    const signature = sign(this.options.secret, {
      method: "POST",
      path: url.pathname + url.search,
      timestamp,
      nonce,
      body,
    });

    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Xibra-Key-Id": this.options.keyId,
          "X-Xibra-Timestamp": timestamp,
          "X-Xibra-Nonce": nonce,
          "X-Xibra-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new ApiUnavailableError("The Xibra API could not be reached.", {
        cause: error,
      });
    }

    const envelope = await readEnvelope(response);

    if (!response.ok) {
      if (envelope !== null) {
        throw new ApiError(
          response.status,
          envelope.code,
          envelope.message,
          envelope.meta,
        );
      }

      throw new ApiError(
        response.status,
        "UNEXPECTED_RESPONSE",
        "The Xibra API returned an unexpected response.",
      );
    }

    if (envelope === null) {
      throw new ApiUnavailableError(
        "The Xibra API returned an unexpected response.",
      );
    }

    return envelope as ApiEnvelope<T>;
  }
}

async function readEnvelope(
  response: Response,
): Promise<ApiEnvelope<unknown> | null> {
  try {
    const json: unknown = await response.json();

    if (typeof json === "object" && json !== null) {
      const candidate = json as Record<string, unknown>;

      if (
        typeof candidate.code === "string" &&
        typeof candidate.message === "string"
      ) {
        const meta = candidate.meta;

        return {
          success: candidate.success === true,
          code: candidate.code,
          message: candidate.message,
          data: candidate.data ?? null,
          meta:
            typeof meta === "object" && meta !== null
              ? (meta as Record<string, unknown>)
              : null,
        };
      }
    }
  } catch {
    // The body is not JSON (for example a proxy error page).
  }

  return null;
}
