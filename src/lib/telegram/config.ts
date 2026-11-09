/**
 * Telegram bot publishing configuration.
 *
 * Deliberately separate from Telegram OIDC login: publishing uses a bot token
 * and channel, never `TELEGRAM_CLIENT_SECRET`. A missing configuration is not
 * fatal — the rest of the app keeps working and publication jobs stay queued.
 */
export interface TelegramBotConfig {
  botToken: string;
  channelId: string;
  apiBaseUrl: string;
}

export type TelegramConfigResult =
  | { ok: true; config: TelegramBotConfig }
  | { ok: false; reason: string };

export function getTelegramBotConfig(): TelegramConfigResult {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const channelId = process.env.TELEGRAM_CHANNEL_ID?.trim();

  if (!botToken) {
    return { ok: false, reason: "TELEGRAM_BOT_TOKEN is not configured" };
  }
  if (!channelId) {
    return { ok: false, reason: "TELEGRAM_CHANNEL_ID is not configured" };
  }

  const apiBaseUrl =
    process.env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org";

  return {
    ok: true,
    config: { botToken, channelId, apiBaseUrl },
  };
}

export function getTelegramChannelId(): string | null {
  const result = getTelegramBotConfig();
  return result.ok ? result.config.channelId : null;
}
