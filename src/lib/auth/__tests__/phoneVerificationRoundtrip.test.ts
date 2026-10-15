import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const state = vi.hoisted(() => ({
  storedRecord: null as null | {
    id: string;
    otpHash: string;
    phoneNumber: string;
    expiresAt: Date;
    verifiedAt: Date | null;
    attempts: number;
    userId: string | null;
  },
  requestId: "req-1",
}));

vi.mock("@/db", () => {
  const returningRows = () => [{ id: state.requestId }];
  return {
    db: {
      query: {
        phoneVerifications: {
          findFirst: vi.fn(() => state.storedRecord),
        },
      },
      insert: vi.fn(() => ({
        values: (values: {
          userId: string | null;
          phoneNumber: string;
          otpHash: string;
          expiresAt: Date;
          attempts: number;
        }) => {
          state.storedRecord = {
            id: state.requestId,
            otpHash: values.otpHash,
            phoneNumber: values.phoneNumber,
            expiresAt: values.expiresAt,
            verifiedAt: null,
            attempts: values.attempts ?? 0,
            userId: values.userId ?? null,
          };
          return { returning: vi.fn(async () => returningRows()) };
        },
      })),
      update: vi.fn(() => ({
        set: () => ({
          where: () => ({
            then: (resolve: (v: unknown) => unknown) => resolve([]),
            catch: async () => [],
            returning: vi.fn(async () => returningRows()),
          }),
        }),
      })),
    },
  };
});

vi.mock("../audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { requestOtp, verifyOtp } from "../phone-verification";

const PHONE = "+251912345678";

beforeEach(() => {
  vi.clearAllMocks();
  state.storedRecord = null;
  resetRateLimitState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestOtp + verifyOtp roundtrip (fake delivery)", () => {
  it("requests an OTP, captures it via the delivery callback, and verifies the captured code", async () => {
    const captured: string[] = [];
    const fakeDeliver = async (p: { phone: string; code: string; requestId: string }) => {
      captured.push(p.code);
    };

    const req = await requestOtp(PHONE, { deliver: fakeDeliver });
    expect(req.ok).toBe(true);
    if (!req.ok) return;

    expect(req.requestId).toBe(state.requestId);
    // A single 6-digit code was captured only into the test-local array.
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/^\d{6}$/);

    const verify = await verifyOtp(req.requestId, captured[0]!, { phone: PHONE });
    expect(verify.ok).toBe(true);
    if (verify.ok) {
      expect(verify.phone).toBe(PHONE);
    }
  });

  it("rejects an incorrect code", async () => {
    const captured: string[] = [];
    const fakeDeliver = async (p: { phone: string; code: string; requestId: string }) => {
      captured.push(p.code);
    };

    const req = await requestOtp(PHONE, { deliver: fakeDeliver });
    expect(req.ok).toBe(true);
    if (!req.ok) return;

    const verify = await verifyOtp(req.requestId, "000000", { phone: PHONE });
    expect(verify.ok).toBe(false);
    if (!verify.ok) {
      expect(verify.reason).toBe("invalid");
    }
    // The correct captured code must still be present (test-local only).
    expect(captured[0]).toMatch(/^\d{6}$/);
  });

  it("does not log anything during the roundtrip with a fake delivery callback", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fakeDeliver = async (p: { phone: string; code: string; requestId: string }) => {
      void p.code;
    };

    const req = await requestOtp(PHONE, { deliver: fakeDeliver });
    expect(req.ok).toBe(true);
    if (req.ok) {
      await verifyOtp(req.requestId, "111111", { phone: PHONE });
    }
    expect(logSpy).not.toHaveBeenCalled();
  });
});
