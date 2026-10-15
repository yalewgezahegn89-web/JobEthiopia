# Telegram Login Setup

Telegram sign-in uses Telegram's OpenID Connect authorization-code flow. The application validates the signed ID token on the server and then creates or looks up a local JobEthiopia account. New Telegram identities are always created as `CANDIDATE`; Telegram authentication never grants administrative privileges.

## 1. Configure Telegram

1. Open Telegram and launch **@BotFather**.
2. Create or choose the bot for JobEthiopia, then open the Login Widget / Web Login settings.
3. Register these allowed URLs:
   - Website origin: `https://jobethiopia.et`
   - Callback URL: `https://jobethiopia.et/api/auth/telegram/callback`
4. Copy the Client ID and Client Secret shown by BotFather.

Do not publish or commit the client secret.

## 2. Configure Vercel

Add these environment variables to both **Production** and the Preview environment used to test the feature:

- `TELEGRAM_CLIENT_ID`: client ID from BotFather.
- `TELEGRAM_CLIENT_SECRET`: client secret from BotFather.

Keep `APP_BASE_URL=https://jobethiopia.et` in Production. Preview may use its own approved callback URL and base URL; add that Preview origin and callback URL to BotFather before testing Telegram login on Preview.

After adding or changing environment variables, redeploy so the new deployment receives them.

## 3. Authentication behavior

- State, nonce, and a PKCE S256 verifier are generated server-side and kept in short-lived HTTP-only cookies.
- The callback exchanges the authorization code server-side and validates the JWT signature, issuer, audience, expiry, and nonce against Telegram's JWKS.
- The unique Telegram subject is linked using the existing `auth_accounts` table. The app never auto-links accounts by display name or email.
- New Telegram logins create only `CANDIDATE` users. Administrator access continues to use the existing password login unless a staff account is explicitly linked by a separately authenticated process.
- The legacy `/phone` page returns users to sign-in; the SMS OTP UI is no longer offered because no delivery provider is configured.

Official Telegram documentation: https://core.telegram.org/bots/telegram-login
