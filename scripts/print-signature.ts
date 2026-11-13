import { sign } from "../src/api/signature.js";

// Fixed inputs for the cross-language check against xibra-api.
const body = JSON.stringify({ telegram_user_id: 1 });

console.log(
  sign("secret", {
    method: "POST",
    path: "/api/v1/bot/account",
    timestamp: "1700000000",
    nonce: "nonce-0123456789abcdef",
    body,
  }),
);
