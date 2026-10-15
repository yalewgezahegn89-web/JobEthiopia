import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveDevOtpDelivery } from "../phone-otp-delivery";

describe("resolveDevOtpDelivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches delivery on Vercel Preview when the flag is log", () => {
    const deliver = resolveDevOtpDelivery({
      vercelEnv: "preview",
      phoneOtpDevDelivery: "log",
    });
    expect(typeof deliver).toBe("function");
  });

  it("does NOT attach delivery on Vercel Production even when the flag is log", () => {
    const deliver = resolveDevOtpDelivery({
      vercelEnv: "production",
      phoneOtpDevDelivery: "log",
    });
    expect(deliver).toBeUndefined();
  });

  it("does NOT attach delivery on Vercel Production when the flag is absent", () => {
    expect(
      resolveDevOtpDelivery({ vercelEnv: "production" }),
    ).toBeUndefined();
  });

  it("does NOT attach delivery on Vercel Preview when the flag is absent (default)", () => {
    expect(
      resolveDevOtpDelivery({ vercelEnv: "preview" }),
    ).toBeUndefined();
  });

  it("does NOT attach delivery when the flag value is not exactly 'log'", () => {
    expect(
      resolveDevOtpDelivery({
        vercelEnv: "preview",
        phoneOtpDevDelivery: "sms",
      }),
    ).toBeUndefined();
  });

  it("attaches delivery in local development (no VERCEL_ENV) when the flag is log (preserves prior local behavior)", () => {
    const deliver = resolveDevOtpDelivery({
      vercelEnv: undefined,
      phoneOtpDevDelivery: "log",
    });
    expect(typeof deliver).toBe("function");
  });

  it("does NOT attach delivery in local development (no VERCEL_ENV) when the flag is absent", () => {
    expect(
      resolveDevOtpDelivery({ vercelEnv: undefined }),
    ).toBeUndefined();
  });

  it("the dev callback logs a clearly prefixed message with phone, requestId, and code", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const deliver = resolveDevOtpDelivery({
      vercelEnv: "preview",
      phoneOtpDevDelivery: "log",
    });
    expect(deliver).toBeDefined();
    await deliver!({ phone: "+251912345678", requestId: "req-1", code: "123456" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const message = String(logSpy.mock.calls[0]![0]);
    expect(message).toContain("[phone-otp-dev]");
    expect(message).toContain("+251912345678");
    expect(message).toContain("req-1");
    expect(message).toContain("123456");
  });
});
