import { describe, it, expect } from "vitest";
import {
  employerCreateJobSchema,
  employerUpdateJobSchema,
  employerJobStatusSchema,
} from "@/lib/validations/employerJob";

const VALID_ORG_ID = "22222222-2222-4222-8222-222222222222";
const VALID_UUID = "33333333-3333-4333-8333-333333333333";

function baseCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: VALID_ORG_ID,
    title: "Software Engineer",
    description: "Build great things",
    ...overrides,
  };
}

describe("employerCreateJobSchema", () => {
  it("accepts minimal valid payload", () => {
    const res = employerCreateJobSchema.safeParse(baseCreateInput());
    expect(res.success).toBe(true);
  });

  it("requires organizationId", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ organizationId: undefined }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toContain("organizationId");
    }
  });

  it("requires title", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ title: undefined }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toContain("title");
    }
  });

  it("requires description", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ description: undefined }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toContain("description");
    }
  });

  it("rejects empty title", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ title: "" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty description", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ description: "" }),
    );
    expect(res.success).toBe(false);
  });

  it("validates organizationId as UUID", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ organizationId: "not-a-uuid" }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toContain("organizationId");
    }
  });

  it("accepts valid optional categoryId", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ categoryId: VALID_UUID }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts valid optional professionId", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ professionId: VALID_UUID }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts valid optional locationId", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ locationId: VALID_UUID }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts valid optional employmentType", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ employmentType: "FULL_TIME" }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts all optional fields populated", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({
        categoryId: VALID_UUID,
        professionId: VALID_UUID,
        locationId: VALID_UUID,
        responsibilities: "Do things",
        requirements: "Know things",
        educationRequirements: "BSc",
        benefits: "Health",
        experienceMin: 2,
        experienceMax: 5,
        employmentType: "FULL_TIME",
        salaryMin: 50000,
        salaryMax: 100000,
        salaryCurrency: "ETB",
        salaryPeriod: "MONTHLY",
        postedAt: "2026-01-01T00:00:00.000Z",
        deadline: "2026-06-01T00:00:00.000Z",
        applicationUrl: "https://example.com/apply",
      }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects salaryMax < salaryMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ salaryMin: 50000, salaryMax: 30000 }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("salaryMax");
    }
  });

  it("accepts salaryMax equal to salaryMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ salaryMin: 50000, salaryMax: 50000 }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts salaryMax without salaryMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ salaryMax: 100000 }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts salaryMin without salaryMax", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ salaryMin: 50000 }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects experienceMax < experienceMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ experienceMin: 5, experienceMax: 2 }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("experienceMax");
    }
  });

  it("accepts experienceMax equal to experienceMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ experienceMin: 3, experienceMax: 3 }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts experienceMax without experienceMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ experienceMax: 10 }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects unknown fields (strict mode)", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ unknownField: "value" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects status as a client-controlled creation field", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ status: "PUBLISHED" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects verificationStatus as a client-controlled creation field", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ verificationStatus: "VERIFIED" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects slug as a client-controlled creation field", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ slug: "my-custom-slug" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects invalid employmentType", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ employmentType: "INVALID" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects invalid salaryPeriod", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ salaryPeriod: "WEEKLY" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects negative salaryMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ salaryMin: -1000 }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects negative experienceMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ experienceMin: -1 }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects non-integer experienceMin", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({ experienceMin: 1.5 }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts null for optional fields", () => {
    const res = employerCreateJobSchema.safeParse(
      baseCreateInput({
        categoryId: null,
        professionId: null,
        locationId: null,
        responsibilities: null,
        requirements: null,
        educationRequirements: null,
        benefits: null,
        experienceMin: null,
        experienceMax: null,
        employmentType: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        postedAt: null,
        deadline: null,
        applicationUrl: null,
      }),
    );
    expect(res.success).toBe(true);
  });
});

describe("employerUpdateJobSchema", () => {
  it("accepts empty payload (no fields to update)", () => {
    const res = employerUpdateJobSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("accepts partial updates", () => {
    const res = employerUpdateJobSchema.safeParse({ title: "New Title" });
    expect(res.success).toBe(true);
  });

  it("rejects unknown fields (strict mode)", () => {
    const res = employerUpdateJobSchema.safeParse({
      title: "Valid",
      status: "PUBLISHED",
    });
    expect(res.success).toBe(false);
  });

  it("rejects salaryMax < salaryMin", () => {
    const res = employerUpdateJobSchema.safeParse({
      salaryMin: 50000,
      salaryMax: 30000,
    });
    expect(res.success).toBe(false);
  });

  it("rejects experienceMax < experienceMin", () => {
    const res = employerUpdateJobSchema.safeParse({
      experienceMin: 5,
      experienceMax: 2,
    });
    expect(res.success).toBe(false);
  });

  it("rejects status update (not editable by employer)", () => {
    const res = employerUpdateJobSchema.safeParse({ status: "PUBLISHED" });
    expect(res.success).toBe(false);
  });

  it("rejects verificationStatus update (not editable by employer)", () => {
    const res = employerUpdateJobSchema.safeParse({
      verificationStatus: "VERIFIED",
    });
    expect(res.success).toBe(false);
  });
});

describe("employerJobStatusSchema", () => {
  it("accepts PENDING_REVIEW", () => {
    const res = employerJobStatusSchema.safeParse({ status: "PENDING_REVIEW" });
    expect(res.success).toBe(true);
  });

  it("accepts DRAFT", () => {
    const res = employerJobStatusSchema.safeParse({ status: "DRAFT" });
    expect(res.success).toBe(true);
  });

  it("rejects PUBLISHED", () => {
    const res = employerJobStatusSchema.safeParse({ status: "PUBLISHED" });
    expect(res.success).toBe(false);
  });

  it("rejects REMOVED", () => {
    const res = employerJobStatusSchema.safeParse({ status: "REMOVED" });
    expect(res.success).toBe(false);
  });

  it("rejects EXPIRED", () => {
    const res = employerJobStatusSchema.safeParse({ status: "EXPIRED" });
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields (strict mode)", () => {
    const res = employerJobStatusSchema.safeParse({
      status: "DRAFT",
      reason: "changing my mind",
    });
    expect(res.success).toBe(false);
  });

  it("rejects missing status", () => {
    const res = employerJobStatusSchema.safeParse({});
    expect(res.success).toBe(false);
  });
});
