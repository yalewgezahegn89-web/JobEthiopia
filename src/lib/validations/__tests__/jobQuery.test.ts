import { describe, it, expect } from "vitest";
import { jobListQuerySchema, jobSortValues } from "../jobQuery";

describe("jobListQuerySchema", () => {
  it("defaults page and limit", () => {
    const parsed = jobListQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.limit).toBe(20);
    }
  });

  it("accepts every supported sort value", () => {
    for (const sort of jobSortValues) {
      const parsed = jobListQuerySchema.safeParse({ sort });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects an unknown sort value", () => {
    const parsed = jobListQuerySchema.safeParse({ sort: "random" });
    expect(parsed.success).toBe(false);
  });

  it("accepts all canonical employment types", () => {
    const parsed = jobListQuerySchema.safeParse({ employmentType: "FREELANCE" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid employment type", () => {
    const parsed = jobListQuerySchema.safeParse({
      employmentType: "REMOTE_ONLY",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a zero salary bound", () => {
    const parsed = jobListQuerySchema.safeParse({ salaryMin: "0" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a negative salary bound", () => {
    expect(jobListQuerySchema.safeParse({ salaryMin: "-1" }).success).toBe(
      false,
    );
    expect(jobListQuerySchema.safeParse({ salaryMax: "-1" }).success).toBe(
      false,
    );
  });

  it("rejects a non-numeric salary bound", () => {
    expect(jobListQuerySchema.safeParse({ salaryMin: "a lot" }).success).toBe(
      false,
    );
  });

  it("rejects an infinite salary bound", () => {
    expect(
      jobListQuerySchema.safeParse({ salaryMin: "Infinity" }).success,
    ).toBe(false);
  });

  it("rejects salaryMin greater than salaryMax", () => {
    const parsed = jobListQuerySchema.safeParse({
      salaryMin: "10000",
      salaryMax: "5000",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts equal salary bounds", () => {
    const parsed = jobListQuerySchema.safeParse({
      salaryMin: "5000",
      salaryMax: "5000",
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps the limit ceiling at 100", () => {
    expect(jobListQuerySchema.safeParse({ limit: "100" }).success).toBe(true);
    expect(jobListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});