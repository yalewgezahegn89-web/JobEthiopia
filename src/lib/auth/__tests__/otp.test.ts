import { describe, it, expect } from "vitest";
import {
  generateOtpCode,
  hashOtp,
  verifyOtpCode,
  evaluateOtp,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from "../otp";

describe("generateOtpCode", () => {
  it("produces a code of the expected length", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(/^\d+$/.test(code)).toBe(true);
    }
  });

  it("can produce leading zeros (zero-padded)", () => {
    // Over many draws, a code starting with 0 must be representable.
    let sawLeadingZero = false;
    for (let i = 0; i < 5000 && !sawLeadingZero; i++) {
      sawLeadingZero = generateOtpCode().startsWith("0");
    }
    expect(sawLeadingZero).toBe(true);
  });

  it("does not leak raw codes as plaintext into storage hashes", async () => {
    const code = generateOtpCode();
    const hash = await hashOtp(code);
    // The stored hash must never contain the raw code.
    expect(hash).not.toContain(code);
    expect(hash.startsWith("scrypt$")).toBe(true);
  });
});

describe("hashOtp / verifyOtpCode", () => {
  it("hashes deterministically-verifiable codes with unique salts", async () => {
    const a = await hashOtp("123456");
    const b = await hashOtp("123456");
    // Unique salt per issuance: same code hashes differently.
    expect(a).not.toBe(b);
  });

  it("accepts the correct code", async () => {
    const hash = await hashOtp("481516");
    await expect(verifyOtpCode(hash, "481516")).resolves.toBe(true);
  });

  it("rejects an incorrect code", async () => {
    const hash = await hashOtp("481516");
    await expect(verifyOtpCode(hash, "999999")).resolves.toBe(false);
  });

  it("rejects codes of the wrong format", async () => {
    const hash = await hashOtp("481516");
    await expect(verifyOtpCode(hash, "12")).resolves.toBe(false);
    await expect(verifyOtpCode(hash, "abcdef")).resolves.toBe(false);
    await expect(verifyOtpCode(hash, "")).resolves.toBe(false);
  });

  it("returns false for a malformed stored hash", async () => {
    await expect(verifyOtpCode("not-a-hash", "481516")).resolves.toBe(false);
    await expect(verifyOtpCode("", "481516")).resolves.toBe(false);
  });
});

describe("evaluateOtp", () => {
  const now = 1_700_000_000_000;
  const future = now + 10 * 60 * 1000;
  const past = now - 1000;

  it("accepts a valid, in-window code", async () => {
    const hash = await hashOtp("123456");
    const verdict = await evaluateOtp(hash, "123456", now, future, 0);
    expect(verdict).toEqual({ ok: true });
  });

  it("rejects an expired code", async () => {
    const hash = await hashOtp("123456");
    const verdict = await evaluateOtp(hash, "123456", now, past, 0);
    expect(verdict).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects once max attempts are used", async () => {
    const hash = await hashOtp("123456");
    const verdict = await evaluateOtp(
      hash,
      "123456",
      now,
      future,
      OTP_MAX_ATTEMPTS,
    );
    expect(verdict).toEqual({ ok: false, reason: "max_attempts" });
  });

  it("rejects an incorrect code as invalid", async () => {
    const hash = await hashOtp("123456");
    const verdict = await evaluateOtp(hash, "000000", now, future, 0);
    expect(verdict).toEqual({ ok: false, reason: "invalid" });
  });
});
