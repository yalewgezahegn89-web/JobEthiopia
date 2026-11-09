/**
 * Telegram bot publishing configuration.
 *
 * Deliberately separate from Telegram OIDC login: publishing uses a bot token
 * and channel, never `TELEGRAM_CLIENT_SECRET`. A missing configuration is not
 * fatal — the rest of the app keeps working and publication jobs stay queued.
 */
export const TELEGRAM_DEFAULT_API_BASE_URL = "https://api.telegram.org";
export const TELEGRAM_API_ORIGIN = "https://api.telegram.org";

export interface TelegramBotConfig {
  botToken: string;
  channelId: string;
  apiBaseUrl: string;
}

export type TelegramConfigResult =
  | { ok: true; config: TelegramBotConfig }
  | { ok: false; reason: string };

export type TelegramApiBaseResult =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: string };

/**
 * The bot token is placed in the request URL path, so the base URL must be the
 * official Telegram Bot API origin over HTTPS. Plaintext HTTP, alternate
 * hosts/ports, userinfo, query strings, fragments and paths are rejected.
 */
export function normalizeTelegramApiBaseUrl(
  raw: string | undefined,
): TelegramApiBaseResult {
  const value = raw?.trim();
  if (!value) {
    return { ok: true, baseUrl: TELEGRAM_DEFAULT_API_BASE_URL };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      reason: "TELEGRAM_API_BASE_URL is not a valid URL",
    };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "TELEGRAM_API_BASE_URL must use HTTPS" };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      reason: "TELEGRAM_API_BASE_URL must not contain credentials",
    };
  }
  if (url.port !== "" && url.port !== "443") {
    return {
      ok: false,
      reason: "TELEGRAM_API_BASE_URL must not use a custom port",
    };
  }
  if (url.search || url.hash) {
    return {
      ok: false,
      reason:
        "TELEGRAM_API_BASE_URL must not contain a query string or fragment",
    };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return {
      ok: false,
      reason: "TELEGRAM_API_BASE_URL must not contain a path",
    };
  }
  if (url.origin !== TELEGRAM_API_ORIGIN) {
    return {
      ok: false,
      reason:
        "TELEGRAM_API_BASE_URL must be the official Telegram Bot API origin",
    };
  }

  return { ok: true, baseUrl: TELEGRAM_API_ORIGIN };
}

export function getTelegramBotConfig(): TelegramConfigResult {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const channelId = process.env.TELEGRAM_CHANNEL_ID?.trim();

  if (!botToken) {
    return { ok: false, reason: "TELEGRAM_BOT_TOKEN is not configured" };
  }
  if (!channelId) {
    return { ok: false, reason: "TELEGRAM_CHANNEL_ID is not configured" };
  }

  const apiBase = normalizeTelegramApiBaseUrl(
    process.env.TELEGRAM_API_BASE_URL,
  );
  if (!apiBase.ok) {
    return { ok: false, reason: apiBase.reason };
  }

  return {
    ok: true,
    config: { botToken, channelId, apiBaseUrl: apiBase.baseUrl },
  };
}

export function getTelegramChannelId(): string | null {
  const result = getTelegramBotConfig();
  return result.ok ? result.config.channelId : null;
}
