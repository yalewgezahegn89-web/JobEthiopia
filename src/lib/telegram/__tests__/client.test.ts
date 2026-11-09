import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTelegramMessage } from "../client";

const CONFIG = {
  botToken: "123:secret-token",
  channelId: "@jobs",
  apiBaseUrl: "https://api.telegram.org/",
};

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendTelegramMessage", () => {
  it("posts an HTML message and returns the message id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { ok: true, result: { message_id: 42 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramMessage(CONFIG, "<b>Hello</b>");

    expect(result).toEqual({ ok: true, messageId: "42" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:secret-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: "@jobs",
          text: "<b>Hello</b>",
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      }),
    );
  });

  it("classifies 429 as retryable and preserves retry_after", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(429, {
          ok: false,
          parameters: { retry_after: 30 },
        }),
      ),
    );

    expect(await sendTelegramMessage(CONFIG, "hi")).toEqual({
      ok: false,
      retryable: true,
      retryAfterSeconds: 30,
      error: "Telegram rate limited the request",
    });
  });

  it("classifies 5xx and network failures as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(503, { ok: false })),
    );
    expect(await sendTelegramMessage(CONFIG, "hi")).toEqual({
      ok: false,
      retryable: true,
      error: "Telegram server error (503)",
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await sendTelegramMessage(CONFIG, "hi")).toEqual({
      ok: false,
      retryable: true,
      error: "Telegram request failed",
    });
  });

  it("classifies 4xx as permanent without leaking the bot token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(response(400, { ok: false, description: "bad" })),
    );

    const result = await sendTelegramMessage(CONFIG, "hi");
    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: "Telegram rejected the message (400)",
    });
    expect(JSON.stringify(result)).not.toContain(CONFIG.botToken);
  });

  it("treats a missing message id as a retryable failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(200, { ok: true, result: {} })),
    );
    expect(await sendTelegramMessage(CONFIG, "hi")).toEqual({
      ok: false,
      retryable: true,
      error: "Telegram response missing message id",
    });
  });
});
