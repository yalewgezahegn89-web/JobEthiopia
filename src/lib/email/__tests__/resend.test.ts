import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailMessage } from "@/lib/email/types";

const mockSend = vi.fn().mockResolvedValue({ data: { id: "msg_1" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

beforeEach(() => {
  mockSend.mockClear();
  mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });
});

describe("createResendTransport", () => {
  it("throws if RESEND_API_KEY is missing", async () => {
    const original = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const { createResendTransport } = await import("@/lib/email/resend");
    expect(() => createResendTransport({ apiKey: undefined, from: "a@b.com" })).toThrow(
      "RESEND_API_KEY is required",
    );
    process.env.RESEND_API_KEY = original;
  });

  it("throws if EMAIL_FROM is missing", async () => {
    const { createResendTransport } = await import("@/lib/email/resend");
    expect(() => createResendTransport({ apiKey: "re_test", from: undefined })).toThrow(
      "EMAIL_FROM is required",
    );
  });

  it("creates a transport that sends via Resend", async () => {
    const { createResendTransport } = await import("@/lib/email/resend");
    const transport = createResendTransport({ apiKey: "re_test", from: "no-reply@test.com" });
    const email: EmailMessage = {
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    };
    await transport.sendEmail(email);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "no-reply@test.com", to: "user@example.com", subject: "Test" }),
    );
  });

  it("delegates sendPasswordResetEmail to the same Resend send", async () => {
    const { createResendTransport } = await import("@/lib/email/resend");
    const transport = createResendTransport({ apiKey: "re_test", from: "no-reply@test.com" });
    await transport.sendPasswordResetEmail({
      to: "u@x.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset</p>",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("includes reply_to when configured", async () => {
    const { createResendTransport } = await import("@/lib/email/resend");
    const transport = createResendTransport({
      apiKey: "re_test",
      from: "no-reply@test.com",
      replyTo: "support@test.com",
    });
    await transport.sendEmail({
      to: "u@x.com",
      subject: "Hi",
      text: "Hi",
      html: "<p>Hi</p>",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ reply_to: "support@test.com" }),
    );
  });

  it("throws on Resend API error", async () => {
    const { createResendTransport } = await import("@/lib/email/resend");
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "Invalid API key" } });
    const transport = createResendTransport({ apiKey: "re_test", from: "no-reply@test.com" });
    await expect(
      transport.sendEmail({ to: "u@x.com", subject: "Hi", text: "Hi", html: "<p>Hi</p>" }),
    ).rejects.toThrow("Resend API error");
  });
});
