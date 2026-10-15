import { describe, it, expect } from "vitest";
import { jsonFeedItemSchema } from "../feedSchema";

function validItem(overrides: Record<string, unknown> = {}) {
  return {
    title: "Software Engineer",
    description: "Build great software for Addis Ababa.",
    organizationName: "Acme Ltd",
    externalId: "acme-123",
    sourceUrl: "https://example.com/jobs/acme-123",
    ...overrides,
  };
}

function withoutKey(item: Record<string, unknown>, key: string) {
  const copy = { ...item };
  delete copy[key];
  return copy;
}

describe("jsonFeedItemSchema", () => {
  it("accepts a minimal valid item", () => {
    expect(jsonFeedItemSchema.safeParse(validItem()).success).toBe(true);
  });

  it("accepts fully-populated items with all optional fields", () => {
    const item = validItem({
      locationName: "Addis Ababa",
      professionName: "Engineering",
      categoryName: "Technology",
      employmentType: "FULL_TIME",
      salaryRaw: "ETB 50,000 monthly",
      experienceRaw: "3-5 years",
      responsibilities: "Write code.",
      requirements: "5+ years experience.",
      educationRequirements: "BSc in Computer Science",
      benefits: "Health insurance",
      postedAt: "2026-09-01T08:00:00.000Z",
      deadline: "2026-10-01T08:00:00.000Z",
      applicationUrl: "https://example.com/apply",
    });
    expect(jsonFeedItemSchema.safeParse(item).success).toBe(true);
  });

  it("accepts nulls for optional fields", () => {
    const item = validItem({
      locationName: null,
      professionName: null,
      categoryName: null,
      employmentType: null,
      salaryRaw: null,
      experienceRaw: null,
      responsibilities: null,
      requirements: null,
      educationRequirements: null,
      benefits: null,
      postedAt: null,
      deadline: null,
      applicationUrl: null,
      externalId: null,
      sourceUrl: null,
    });
    expect(jsonFeedItemSchema.safeParse(item).success).toBe(true);
  });

  it("strips unknown extra keys", () => {
    const parsed = jsonFeedItemSchema.safeParse(
      validItem({ extraField: "ignored", nested: { a: 1 } }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("extraField" in parsed.data).toBe(false);
      expect("nested" in parsed.data).toBe(false);
    }
  });

  it("rejects a missing title", () => {
    expect(jsonFeedItemSchema.safeParse(withoutKey(validItem(), "title")).success).toBe(false);
  });

  it("rejects a missing description", () => {
    expect(jsonFeedItemSchema.safeParse(withoutKey(validItem(), "description")).success).toBe(false);
  });

  it("rejects a missing organizationName", () => {
    expect(jsonFeedItemSchema.safeParse(withoutKey(validItem(), "organizationName")).success).toBe(false);
  });

  it("rejects a blank title", () => {
    expect(jsonFeedItemSchema.safeParse(validItem({ title: "" })).success).toBe(
      false,
    );
  });

  it("rejects a non-ISO postedAt", () => {
    expect(
      jsonFeedItemSchema.safeParse(validItem({ postedAt: "yesterday" })).success,
    ).toBe(false);
  });

  it("rejects a non-http applicationUrl", () => {
    expect(
      jsonFeedItemSchema.safeParse(
        validItem({ applicationUrl: "javascript:alert(1)" }),
      ).success,
    ).toBe(false);
  });

  it("rejects a non-http sourceUrl", () => {
    expect(
      jsonFeedItemSchema.safeParse(validItem({ sourceUrl: "ftp://x.test" }))
        .success,
    ).toBe(false);
  });
});