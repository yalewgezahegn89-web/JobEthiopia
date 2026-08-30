import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPasswordResetEmail,
  dispatchPasswordResetEmail,
  setEmailTransport,
} from "@/lib/email";

describe("buildPasswordResetEmail", () => {
  it("builds a well-formed reset email", () => {
    const email = buildPasswordResetEmail("u@example.com", "https://app.example.com/reset-password?token=abc");
    expect(email.to).toBe("u@example.com");
    expect(email.subject).toContain("Reset");
    expect(email.text).toContain("https://app.example.com/reset-password?token=abc");
    expect(email.html).toContain("30 minutes");
  });

  it("HTML-escapes the reset URL", () => {
    const email = buildPasswordResetEmail("u@example.com", 'https://x.example/?a="b"&c=<d>');
    expect(email.html).not.toContain('<a href="https://x.example/?a="');
    expect(email.html).toContain("&amp;");
    expect(email.html).toContain("&lt;");
  });

  it("does not hint at the raw token outside the URL", () => {
    const email = buildPasswordResetEmail("u@example.com", "https://x/?token=secret-token");
    expect(email.subject).not.toContain("secret-token");
  });
});

describe("email transport injection", () => {
  const send = vi.fn();

  beforeEach(() => {
    send.mockReset();
    setEmailTransport({ sendPasswordResetEmail: send });
  });

  afterEach(() => {
    setEmailTransport({ sendPasswordResetEmail: async () => {} });
    vi.restoreAllMocks();
  });

  it("dispatches a password reset email via the injected transport", async () => {
    await dispatchPasswordResetEmail("u@example.com", "https://x.example/?token=abc");
    expect(send).toHaveBeenCalledTimes(1);
    const [email] = send.mock.calls[0];
    expect(email.to).toBe("u@example.com");
    expect(email.text).toContain("token=abc");
  });

  it("never logs the raw token", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await dispatchPasswordResetEmail("u@example.com", "https://x.example/?token=topsecret");
    const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("topsecret");
  });

  it("logs email_reset_dispatch_failed without the token or URL on provider failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValue(new Error("SMTP unreachable"));

    await expect(
      dispatchPasswordResetEmail(
        "u@example.com",
        "https://x.example/?token=shouldnotleak",
      ),
    ).rejects.toThrow("SMTP unreachable");

    const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const failed = records.find((r) => r.event === "email_reset_dispatch_failed");
    expect(failed).toBeDefined();
    expect(failed.errorCode).toBe("EMAIL_DISPATCH_FAILED");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("shouldnotleak");
    expect(raw).not.toContain("https://x.example/");
  });
});
