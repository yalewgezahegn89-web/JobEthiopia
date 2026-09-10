import { describe, it, expect } from "vitest";
import {
  createJobAlertSchema,
  updateJobAlertSchema,
  jobAlertIdParamSchema,
} from "@/lib/validations/jobAlerts";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("createJobAlertSchema", () => {
  it("accepts a minimal valid alert", () => {
    const parsed = createJobAlertSchema.safeParse({
      name: "Accountant roles",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.frequency).toBe("DAILY");
      expect(parsed.data.locale).toBe("en");
      expect(parsed.data.keywords).toBeUndefined();
    }
  });

  it("accepts a fully populated alert", () => {
    const parsed = createJobAlertSchema.safeParse({
      name: "  Auditor in Addis  ",
      keywords: " auditor , IFRS ",
      categoryId: UUID,
      professionId: UUID,
      locationId: UUID,
      employmentType: "FULL_TIME",
      frequency: "INSTANT",
      locale: "am",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Auditor in Addis");
      expect(parsed.data.keywords).toBe("auditor , IFRS");
    }
  });

  it("rejects a missing name", () => {
    const parsed = createJobAlertSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects an overlong name", () => {
    const parsed = createJobAlertSchema.safeParse({
      name: "x".repeat(81),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects overlong keywords", () => {
    const parsed = createJobAlertSchema.safeParse({
      name: "Alert",
      keywords: "x".repeat(201),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown frequency and locale", () => {
    expect(
      createJobAlertSchema.safeParse({ name: "A", frequency: "HOURLY" }).success,
    ).toBe(false);
    expect(
      createJobAlertSchema.safeParse({ name: "A", locale: "fr" }).success,
    ).toBe(false);
  });

  it("rejects invalid uuid filters", () => {
    expect(
      createJobAlertSchema.safeParse({ name: "A", categoryId: "not-a-uuid" })
        .success,
    ).toBe(false);
    expect(
      createJobAlertSchema.safeParse({ name: "A", employmentType: "REMOTE" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(
      createJobAlertSchema.safeParse({ name: "A", xss: "bad" }).success,
    ).toBe(false);
  });
});

describe("updateJobAlertSchema", () => {
  it("accepts partial updates", () => {
    const parsed = updateJobAlertSchema.safeParse({ status: "PAUSED" });
    expect(parsed.success).toBe(true);
    const full = updateJobAlertSchema.safeParse({
      name: "New name",
      keywords: null,
      frequency: "INSTANT",
    });
    expect(full.success).toBe(true);
    if (full.success) expect(full.data.keywords).toBeNull();
  });

  it("rejects unknown keys", () => {
    expect(
      updateJobAlertSchema.safeParse({ createdAt: "now" }).success,
    ).toBe(false);
  });
});

describe("jobAlertIdParamSchema", () => {
  it("accepts a uuid", () => {
    expect(jobAlertIdParamSchema.safeParse({ alertId: UUID }).success).toBe(true);
  });

  it("rejects a non-uuid", () => {
    expect(
      jobAlertIdParamSchema.safeParse({ alertId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});