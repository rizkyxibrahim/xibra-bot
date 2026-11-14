# xibra-bot

Telegram interface for Xibra Platform. It talks to `xibra-api` only and never touches the database.

Features are grouped into modules under `src/modules/`. Each module registers its own commands and buttons. Only the Home and Invitations modules are implemented; the other menu entries are placeholders.

## Commands

| Command | What it does |
| --- | --- |
| `/start [code]` | Welcome message; with a code it links the account |
| `/help` | List commands |
| `/link <code>` | Link this Telegram account to a Xibra account |
| `/me` | Show the linked account |
| `/invite` | Create an invitation (Owner only) |
| `/invites` | List the latest invitations and revoke pending ones (Owner only) |
| `/batal`, `/cancel` | Stop the current step-by-step flow |

Most actions are also available as buttons from the home menu.
When a step asks a question, tap an option or, where allowed, type the answer.
Every step offers Kembali (back), Batal (cancel), and Home.

## Invitations

- Codes use the format `XIBRA-XXXX-XXXX` (for example `XIBRA-FKVW-SBZE`).
  The characters come from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, so `0`, `1`, `I`, `L`, and `O` never appear.
- A code is single use, expires after 1 to 72 hours, and can be revoked.
- The code and link are shown once, right after creation. Share them privately.
- The API generates and validates codes. The bot only displays them.

## Setup

```bash
npm install
cp .env.example .env     # then fill in the values
npm run typecheck
npm test
npm run smoke            # needs the API running; checks signed requests
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather. Never commit the real value. |
| `XIBRA_API_BASE_URL` | No | Origin of the API, without a path. Defaults to `http://127.0.0.1:8000`. Must use https in production. |
| `XIBRA_BOT_KEY_ID` | Yes | Must match `XIBRA_BOT_KEY_ID` in the API environment. |
| `XIBRA_BOT_SECRET` | Yes | Must match the API secret. Minimum length is enforced at startup. |
| `XIBRA_API_TIMEOUT_MS` | No | Integer between 1000 and 60000. Defaults to 10000. |
| `LOG_LEVEL` | No | Defaults to `info`. |

The bot refuses to start when a required value is missing or invalid.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run with file watching (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled bot |
| `npm run typecheck` | Type check without emitting |
| `npm test` | Run the Vitest suite |
| `npm run smoke` | Send a signed request to the API |
| `npm run print-signature` | Print a signature for debugging |

## Layout

```
src/
  index.ts          entry point
  config.ts         environment validation
  logger.ts         logging
  api/              signed API client, signature, response types
  bot/              bot creation, legacy commands, errors, formatting
  core/             shared code: wizard engine, UI helpers, linked-account checks
  modules/          one folder per feature module (home, invitations, ...)
tests/              Vitest tests (bot, client, config, signature, wizard)
scripts/            smoke test and signature helper
```

## Security notes

- Requests to the API are HMAC-signed (see `src/api/signature.ts`). The API rejects unsigned, stale, and replayed requests.
- The bot only answers in private chats, so codes and invitations never appear in a group.
- The acting user is resolved by the API from the verified Telegram user ID, never from a username.
- Owner-only actions are checked by the API. The bot hides them from members as a convenience, not as a security boundary.
- Passwords are never requested or handled in Telegram.
- The message that carries a link code is deleted after use (best effort).