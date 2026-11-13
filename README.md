# xibra-bot

Telegram interface for Xibra Platform. It talks to `xibra-api` only; it never touches the database.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values.
3. Start the API, then run `npm run smoke` to verify signed requests are accepted.
4. `npm run dev`

## Commands

| Command | Purpose |
|---|---|
| `/start [code]` | Welcome message; with a code it links the account |
| `/help` | List commands |
| `/link <code>` | Link this Telegram account to a Xibra account |
| `/me` | Show the linked account |
| `/invite [hours] [note]` | Create an invitation (Owner only) |

## Security notes

- The bot only answers in private chats.
- Requests to the API are HMAC-signed (see `src/api/signature.ts`).
- The Telegram user ID is taken from the verified Telegram update only.
- Passwords are never requested or handled in Telegram.