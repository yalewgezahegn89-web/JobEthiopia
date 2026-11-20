import { normalizeTelegramApiBaseUrl } from "./config";
import type { TelegramBotConfig } from "./config";

export type TelegramSendResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      retryable: boolean;
      retryAfterSeconds?: number;
      error: string;
    };

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number | string };
  parameters?: { retry_after?: number };
}

const REQUEST_TIMEOUT_MS = 10_000;

function parseResponse(body: string): TelegramApiResponse | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as TelegramApiResponse;
  } catch {
    return null;
  }
}

/**
 * Sends one HTML-formatted message through the Telegram Bot API.
 *
 * The bot token is only ever placed in the request path and is never logged or
 * included in returned errors. HTTP 429 and 5xx responses are reported as
 * retryable; 4xx responses (bad chat id, blocked bot, malformed message) are
 * permanent.
 */
export async function sendTelegramMessage(
  config: TelegramBotConfig,
  text: string,
): Promise<TelegramSendResult> {
  const apiBase = normalizeTelegramApiBaseUrl(config.apiBaseUrl);
  if (!apiBase.ok) {
    return {
      ok: false,
      retryable: false,
      error: "Telegram API base URL is not allowed",
    };
  }

  const url = `${apiBase.baseUrl}/bot${config.botToken}/sendMessage`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.channelId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return { ok: false, retryable: true, error: "Telegram request failed" };
  } finally {
    clearTimeout(timeout);
  }

  const bodyText = await response.text().catch(() => "");
  const body = parseResponse(bodyText);
  const retryAfterSeconds = body?.parameters?.retry_after;

  if (response.ok && body?.ok !== false) {
    const messageId = body?.result?.message_id;
    if (messageId === undefined || messageId === null) {
      return {
        ok: false,
        retryable: true,
        error: "Telegram response missing message id",
      };
    }
    return { ok: true, messageId: String(messageId) };
  }

  if (response.status === 429) {
    return {
      ok: false,
      retryable: true,
      retryAfterSeconds,
      error: "Telegram rate limited the request",
    };
  }

  if (response.status >= 500) {
    return {
      ok: false,
      retryable: true,
      error: `Telegram server error (${response.status})`,
    };
  }

  return {
    ok: false,
    retryable: false,
    error: `Telegram rejected the message (${response.status})`,
  };
}
