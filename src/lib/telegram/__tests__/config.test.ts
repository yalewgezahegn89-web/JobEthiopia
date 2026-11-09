import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getTelegramBotConfig,
  getTelegramChannelId,
} from "../config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getTelegramBotConfig", () => {
  it("fails safely when the bot token is missing", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "@jobs");
    expect(getTelegramBotConfig()).toEqual({
      ok: false,
      reason: "TELEGRAM_BOT_TOKEN is not configured",
    });
  });

  it("fails safely when the channel is missing", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "");
    expect(getTelegramBotConfig()).toEqual({
      ok: false,
      reason: "TELEGRAM_CHANNEL_ID is not configured",
    });
  });

  it("uses the public Telegram API by default and trims values", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", " 123:abc ");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", " @jobs ");
    vi.stubEnv("TELEGRAM_API_BASE_URL", "");
    expect(getTelegramBotConfig()).toEqual({
      ok: true,
      config: {
        botToken: "123:abc",
        channelId: "@jobs",
        apiBaseUrl: "https://api.telegram.org",
      },
    });
  });

  it("honours an overridden API base URL", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "@jobs");
    vi.stubEnv("TELEGRAM_API_BASE_URL", "https://telegram.internal");
    expect(getTelegramBotConfig()).toEqual({
      ok: true,
      config: {
        botToken: "123:abc",
        channelId: "@jobs",
        apiBaseUrl: "https://telegram.internal",
      },
    });
  });

  it("does not use the OIDC client secret as a bot token", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CLIENT_SECRET", "oidc-secret");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "@jobs");
    expect(getTelegramBotConfig().ok).toBe(false);
  });
});

describe("getTelegramChannelId", () => {
  it("returns null when publishing is not configured", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "@jobs");
    expect(getTelegramChannelId()).toBeNull();
  });

  it("returns the channel when configured", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "@jobs");
    expect(getTelegramChannelId()).toBe("@jobs");
  });
});
