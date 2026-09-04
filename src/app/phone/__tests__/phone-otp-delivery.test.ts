import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveDevOtpDelivery } from "../phone-otp-delivery";

describe("resolveDevOtpDelivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attach delivery when NODE_ENV is production, even if the flag is log", () => {
    const deliver = resolveDevOtpDelivery({
      nodeEnv: "production",
      phoneOtpDevDelivery: "log",
    });
    expect(deliver).toBeUndefined();
  });

  it("does not attach delivery in production when the flag is absent", () => {
    expect(
      resolveDevOtpDelivery({ nodeEnv: "production" }),
    ).toBeUndefined();
  });

  it("does not attach delivery in non-production when the flag is absent (default)", () => {
    expect(
      resolveDevOtpDelivery({ nodeEnv: "development" }),
    ).toBeUndefined();
  });

  it("does not attach delivery when the flag value is not exactly 'log'", () => {
    expect(
      resolveDevOtpDelivery({
        nodeEnv: "development",
        phoneOtpDevDelivery: "sms",
      }),
    ).toBeUndefined();
  });

  it("attaches delivery only when non-production AND the flag is log", () => {
    const deliver = resolveDevOtpDelivery({
      nodeEnv: "development",
      phoneOtpDevDelivery: "log",
    });
    expect(typeof deliver).toBe("function");
  });

  it("the dev callback logs a clearly prefixed message with phone, requestId, and code", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const deliver = resolveDevOtpDelivery({
      nodeEnv: "development",
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
