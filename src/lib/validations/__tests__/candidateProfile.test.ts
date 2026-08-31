import { describe, it, expect } from "vitest";
import {
  candidateProfileSchema,
  normalizePhone,
} from "@/lib/validations/candidateProfile";

const VALID_LOCATION = "22222222-2222-4222-8222-222222222222";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    phone: "+251911234567",
    locationId: VALID_LOCATION,
    professionalSummary: "Engineer",
    totalExperienceYears: 5,
    education: "BSc",
    ...overrides,
  };
}

describe("candidateProfileSchema", () => {
  it("accepts a valid profile", () => {
    const res = candidateProfileSchema.safeParse(baseInput());
    expect(res.success).toBe(true);
  });

  it("normalizes phone spacing/dashes/dots", () => {
    expect(normalizePhone("0911 234 567")).toBe("0911234567");
    expect(normalizePhone("+251-911-234-567")).toBe("+251911234567");
  });

  it("normalizes phone on parse", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ phone: "+251-911-234-567" }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBe("+251911234567");
  });

  it("rejects a phone with invalid letters", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ phone: "0911 2A4 567" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects a phone that is too short", () => {
    const res = candidateProfileSchema.safeParse(baseInput({ phone: "123" }));
    expect(res.success).toBe(false);
  });

  it("rejects a phone that is too long", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ phone: "+2519112345678912" }),
    );
    expect(res.success).toBe(false);
  });

  it("maps blank phone to null", () => {
    const res = candidateProfileSchema.safeParse(baseInput({ phone: "" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBeNull();
  });

  it("maps whitespace-only summary to null", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ professionalSummary: "   " }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.professionalSummary).toBeNull();
  });

  it("rejects summary over 1000 chars", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ professionalSummary: "a".repeat(1001) }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects education over 200 chars", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ education: "a".repeat(201) }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts experience 0", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ totalExperienceYears: 0 }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts experience 60", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ totalExperienceYears: 60 }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects experience 61", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ totalExperienceYears: 61 }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects a negative experience", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ totalExperienceYears: -1 }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts a null location", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ locationId: null }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty location to null", () => {
    const res = candidateProfileSchema.safeParse(baseInput({ locationId: "" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.locationId).toBeNull();
  });

  it("rejects a malformed location UUID", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ locationId: "not-a-uuid" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const res = candidateProfileSchema.safeParse(
      baseInput({ candidateId: "abc" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects forgeries of identity fields", () => {
    for (const key of [
      "userId",
      "email",
      "role",
      "isActive",
      "createdAt",
      "updatedAt",
    ]) {
      const res = candidateProfileSchema.safeParse(baseInput({ [key]: "x" }));
      expect(res.success).toBe(false);
    }
  });

  it("rejects a client-supplied candidateId", () => {
    const res = candidateProfileSchema.safeParse(baseInput({ candidateId: "x" }));
    expect(res.success).toBe(false);
  });
});
