import { describe, it, expect } from "vitest";
import { createJobSchema, updateJobSchema } from "@/lib/validations";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function baseCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Software Engineer",
    slug: "software-engineer",
    description: "A software engineering role",
    ...overrides,
  };
}

describe("createJobSchema server-owned fields", () => {
  it("accepts a minimal valid payload without server-owned fields", () => {
    const res = createJobSchema.safeParse(baseCreateInput());
    expect(res.success).toBe(true);
  });

  it("rejects caller-supplied verificationStatus VERIFIED", () => {
    const res = createJobSchema.safeParse(
      baseCreateInput({ verificationStatus: "VERIFIED" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects caller-supplied verificationStatus PENDING", () => {
    const res = createJobSchema.safeParse(
      baseCreateInput({ verificationStatus: "PENDING" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects caller-supplied status PUBLISHED", () => {
    const res = createJobSchema.safeParse(
      baseCreateInput({ status: "PUBLISHED" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects caller-supplied status DRAFT", () => {
    const res = createJobSchema.safeParse(
      baseCreateInput({ status: "DRAFT" }),
    );
    expect(res.success).toBe(false);
  });

  it("does not accept arbitrary organizationId", () => {
    const res = createJobSchema.safeParse(
      baseCreateInput({ organizationId: VALID_UUID }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects arbitrary unknown fields (strict mode)", () => {
    const res = createJobSchema.safeParse(
      baseCreateInput({ unknownField: "value" }),
    );
    expect(res.success).toBe(false);
  });
});

describe("updateJobSchema verificationStatus blocking", () => {
  it("rejects verificationStatus VERIFIED", () => {
    const res = updateJobSchema.safeParse({ verificationStatus: "VERIFIED" });
    expect(res.success).toBe(false);
  });

  it("rejects verificationStatus PENDING", () => {
    const res = updateJobSchema.safeParse({ verificationStatus: "PENDING" });
    expect(res.success).toBe(false);
  });

  it("rejects arbitrary unknown fields (strict mode)", () => {
    const res = updateJobSchema.safeParse({ unknownField: "value" });
    expect(res.success).toBe(false);
  });

  it("still accepts legitimate status transitions", () => {
    const res = updateJobSchema.safeParse({ status: "PUBLISHED" });
    expect(res.success).toBe(true);
  });

  it("still accepts an empty partial payload", () => {
    const res = updateJobSchema.safeParse({});
    expect(res.success).toBe(true);
  });
});