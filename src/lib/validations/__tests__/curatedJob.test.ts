import { describe, it, expect } from "vitest";
import {
  curatedCreateJobSchema,
  curatedOriginalSourceSchema,
} from "@/lib/validations/curatedJob";
import { employerCreateJobSchema } from "@/lib/validations/employerJob";

const VALID_ORG_ID = "22222222-2222-4222-8222-222222222222";
const VALID_UUID = "33333333-3333-4333-8333-333333333333";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: VALID_ORG_ID,
    title: "Software Engineer",
    description: "Build great things",
    ...overrides,
  };
}

describe("curatedCreateJobSchema — base contract", () => {
  it("accepts the same minimal payload as employerCreateJobSchema", () => {
    const res = curatedCreateJobSchema.safeParse(baseInput());
    expect(res.success).toBe(true);
  });

  it("inherits required employer fields (title, description, organizationId)", () => {
    expect(curatedCreateJobSchema.safeParse(baseInput({ title: "" })).success).toBe(false);
    expect(curatedCreateJobSchema.safeParse(baseInput({ description: "" })).success).toBe(false);
    expect(
      curatedCreateJobSchema.safeParse(baseInput({ organizationId: "nope" })).success,
    ).toBe(false);
  });

  it("rejects unknown top-level fields (strict mode) — status cannot be injected", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({ status: "PUBLISHED", verificationStatus: "VERIFIED" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects a raw sourceId/sourceType (provenance is server-resolved)", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({ sourceId: VALID_UUID, sourceType: "MANUAL" }),
    );
    expect(res.success).toBe(false);
  });
});

describe("curatedCreateJobSchema — optional original source", () => {
  const validOriginalSource = {
    sourceName: "UNICEF Careers Website",
    sourceUrl: "https://jobs.unicef.org/cw/en-us/job/595227",
    externalId: "595227",
  };

  it("accepts a fully-populated original source block", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({ originalSource: validOriginalSource }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts an original source without an external id", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({ originalSource: { ...validOriginalSource, externalId: undefined } }),
    );
    expect(res.success).toBe(true);
  });

  it("requires sourceName when the block is present", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({
        originalSource: { sourceUrl: validOriginalSource.sourceUrl },
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.startsWith("originalSource"))).toBe(true);
    }
  });

  it("requires sourceUrl when the block is present", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({ originalSource: { sourceName: "UNICEF Careers Website" } }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects a non-http(s) sourceUrl (e.g. internal provenance URLs)", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({
        originalSource: {
          sourceName: "UNICEF Careers Website",
          sourceUrl: "jobethiopia://source/abc/external/none",
        },
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects a malformed sourceUrl", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({
        originalSource: { sourceName: "X", sourceUrl: "not a url" },
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects an empty trimmed sourceName", () => {
    const res = curatedOriginalSourceSchema.safeParse({
      sourceName: "   ",
      sourceUrl: "https://jobs.unicef.org",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an empty trimmed externalId", () => {
    const res = curatedOriginalSourceSchema.safeParse({
      sourceName: "UNICEF Careers Website",
      sourceUrl: "https://jobs.unicef.org",
      externalId: "   ",
    });
    expect(res.success).toBe(false);
  });

  it("keeps the employer contract strict: employer payloads including originalSource are still valid input for the curated path", () => {
    const res = curatedCreateJobSchema.safeParse(
      baseInput({ originalSource: validOriginalSource }),
    );
    expect(res.success).toBe(true);
  });

  it("does not leak originalSource into the employer API schema (employer path rejects it)", () => {
    const res = employerCreateJobSchema.safeParse(
      baseInput({ originalSource: validOriginalSource }),
    );
    expect(res.success).toBe(false);
  });
});

describe("curatedCreateJobSchema — applicationUrl scheme restriction", () => {
  it.each(["https://example.com/apply", "http://example.com/apply"])(
    "accepts %s",
    (applicationUrl) => {
      expect(
        curatedCreateJobSchema.safeParse(baseInput({ applicationUrl })).success,
      ).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com",
    "mailto:admin@example.com",
    "not a url",
  ])("rejects %s", (applicationUrl) => {
    expect(
      curatedCreateJobSchema.safeParse(baseInput({ applicationUrl })).success,
    ).toBe(false);
  });

  it("lets empty and null applicationUrl pass through unchanged", () => {
    expect(curatedCreateJobSchema.safeParse(baseInput()).success).toBe(true);
    expect(
      curatedCreateJobSchema.safeParse(baseInput({ applicationUrl: null })).success,
    ).toBe(true);
  });
});