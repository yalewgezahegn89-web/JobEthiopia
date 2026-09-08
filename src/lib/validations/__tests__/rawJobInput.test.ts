import { describe, it, expect } from "vitest";
import { validateRawJobInput } from "@/lib/validations/rawJobInput";

const baseInput = {
  title: "Software Engineer",
  description: "Build great things",
  organizationName: "ACME",
  sourceId: "source-1",
};

describe("validateRawJobInput applicationUrl scheme restriction", () => {
  it.each(["https://example.com/apply", "http://example.com/apply"])(
    "accepts %s",
    (applicationUrl) => {
      const res = validateRawJobInput({ ...baseInput, applicationUrl });
      expect(res.success).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com",
    "mailto:admin@example.com",
    "not a url",
  ])("rejects %s", (applicationUrl) => {
    const res = validateRawJobInput({ ...baseInput, applicationUrl });
    expect(res.success).toBe(false);
  });

  it("lets empty and null applicationUrl pass through unchanged", () => {
    expect(validateRawJobInput(baseInput).success).toBe(true);
    expect(validateRawJobInput({ ...baseInput, applicationUrl: null }).success).toBe(true);
  });
});