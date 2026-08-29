import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  isValidPasswordInput,
  MIN_PASSWORD_LENGTH,
} from "../password";

describe("password", () => {
  it("hashes a password successfully", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
  });

  it("produces a self-describing scrypt format", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toBe("16384");
  });

  it("does not store the plaintext password in the hash", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });

  it("uses a fresh salt so identical passwords hash differently", async () => {
    const a = await hashPassword("same-password-123");
    const b = await hashPassword("same-password-123");
    expect(a).not.toBe(b);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const ok = await verifyPassword(hash, "correct horse battery staple");
    expect(ok).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const ok = await verifyPassword(hash, "wrong password");
    expect(ok).toBe(false);
  });

  it("rejects a malformed hash rather than throwing", async () => {
    const ok = await verifyPassword("not-a-scrypt-hash", "anything");
    expect(ok).toBe(false);
  });

  it("rejects empty hashes quietly", async () => {
    const ok = await verifyPassword("", "anything");
    expect(ok).toBe(false);
  });

  it("rejects a too-short password at hash time", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("accepts passwords at least the minimum length", async () => {
    const password = "x".repeat(MIN_PASSWORD_LENGTH);
    await expect(hashPassword(password)).resolves.toBeTruthy();
  });

  it("validates login input without enforcing policy", () => {
    expect(isValidPasswordInput("any-length")).toBe(true);
    expect(isValidPasswordInput("")).toBe(false);
  });
});