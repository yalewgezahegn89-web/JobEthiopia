import { describe, it, expect } from "vitest";
import {
  normalizeEthiopianPhone,
  isValidEthiopianMobileNsn,
} from "../phone";

describe("normalizeEthiopianPhone", () => {
  it("normalizes Ethio telecom local format", () => {
    expect(normalizeEthiopianPhone("0912345678")).toBe("+251912345678");
    expect(normalizeEthiopianPhone("0998765432")).toBe("+251998765432");
  });

  it("normalizes Safaricom Ethiopia local format", () => {
    expect(normalizeEthiopianPhone("0712345678")).toBe("+251712345678");
    expect(normalizeEthiopianPhone("0700000001")).toBe("+251700000001");
  });

  it("normalizes Ethio telecom international format", () => {
    expect(normalizeEthiopianPhone("+251912345678")).toBe("+251912345678");
    expect(normalizeEthiopianPhone("251912345678")).toBe("+251912345678");
  });

  it("normalizes Safaricom Ethiopia international format", () => {
    expect(normalizeEthiopianPhone("+251712345678")).toBe("+251712345678");
    expect(normalizeEthiopianPhone("251712345678")).toBe("+251712345678");
  });

  it("handles whitespace, hyphen and parenthesis variants", () => {
    expect(normalizeEthiopianPhone("  0912 345 678  ")).toBe("+251912345678");
    expect(normalizeEthiopianPhone("+251 91 234 56 78")).toBe("+251912345678");
    expect(normalizeEthiopianPhone("+251-91-234-5678")).toBe("+251912345678");
    expect(normalizeEthiopianPhone("(+251) 912 345 678")).toBe("+251912345678");
    expect(normalizeEthiopianPhone(" 07 12 34 56 78 ")).toBe("+251712345678");
  });

  it("rejects invalid lengths", () => {
    expect(normalizeEthiopianPhone("091234567")).toBeNull();
    expect(normalizeEthiopianPhone("09123456789")).toBeNull();
    expect(normalizeEthiopianPhone("+25191234567")).toBeNull();
    expect(normalizeEthiopianPhone("+25191234567890")).toBeNull();
    expect(normalizeEthiopianPhone("07123456")).toBeNull();
  });

  it("rejects invalid prefixes (Ethiopian non-mobile ranges)", () => {
    expect(normalizeEthiopianPhone("0112345678")).toBeNull(); // fixed line
    expect(normalizeEthiopianPhone("0612345678")).toBeNull(); // unknown
    expect(normalizeEthiopianPhone("0812345678")).toBeNull(); // unknown
    expect(normalizeEthiopianPhone("+251111111111")).toBeNull();
  });

  it("rejects malformed and non-Ethiopian values", () => {
    expect(normalizeEthiopianPhone("")).toBeNull();
    expect(normalizeEthiopianPhone("not a phone")).toBeNull();
    expect(normalizeEthiopianPhone("abc")).toBeNull();
    expect(normalizeEthiopianPhone("+115550100")).toBeNull(); // US
    expect(normalizeEthiopianPhone("+254712345678")).toBeNull(); // Kenya
    expect(normalizeEthiopianPhone("+251")).toBeNull();
    expect(normalizeEthiopianPhone("+2519")).toBeNull();
    expect(normalizeEthiopianPhone("12345678901")).toBeNull();
    expect(normalizeEthiopianPhone("+251 1234 5678")).toBeNull();
    expect(normalizeEthiopianPhone("9")).toBeNull();
    // @ts-expect-error non-string input is not a valid public input
    expect(normalizeEthiopianPhone(null)).toBeNull();
    // @ts-expect-error non-string input is not a valid public input
    expect(normalizeEthiopianPhone(912345678)).toBeNull();
  });

  it("normalizes to a single canonical form", () => {
    const a = normalizeEthiopianPhone("0912345678");
    const b = normalizeEthiopianPhone("+251912345678");
    const c = normalizeEthiopianPhone("+251 91 234 56 78");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("isValidEthiopianMobileNsn", () => {
  it("accepts 9-digit NSNs starting with 9 or 7", () => {
    expect(isValidEthiopianMobileNsn("912345678")).toBe(true);
    expect(isValidEthiopianMobileNsn("712345678")).toBe(true);
  });

  it("rejects wrong length or prefix", () => {
    expect(isValidEthiopianMobileNsn("91234567")).toBe(false);
    expect(isValidEthiopianMobileNsn("91234567890")).toBe(false);
    expect(isValidEthiopianMobileNsn("112345678")).toBe(false);
    expect(isValidEthiopianMobileNsn("812345678")).toBe(false);
    expect(isValidEthiopianMobileNsn("abc")).toBe(false);
  });
});
