import { describe, it, expect } from "vitest";
import {
  sourceInvariantIssues,
  updateSourceSchema,
  validateMergedSourceUpdate,
} from "../index";

const FACEBOOK_SOURCE = {
  sourceType: "FACEBOOK",
  baseUrl: "https://www.facebook.com/example",
  facebookPageId: "page-1",
  facebookPageKind: "OWNED_PAGE",
  facebookApprovalState: "NOT_REQUESTED",
  facebookContentUseState: "NOT_RECORDED",
};

describe("validateMergedSourceUpdate", () => {
  it("allows an unrelated field update on a valid Facebook source", () => {
    const result = validateMergedSourceUpdate(FACEBOOK_SOURCE, {
      name: "Renamed Page",
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects removing the Facebook Page ID", () => {
    const result = validateMergedSourceUpdate(FACEBOOK_SOURCE, {
      facebookPageId: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("Page ID");
  });

  it("rejects changing the Page kind without authorization metadata", () => {
    const withoutMetadata = {
      ...FACEBOOK_SOURCE,
      facebookApprovalState: null,
      facebookContentUseState: null,
    };
    const result = validateMergedSourceUpdate(withoutMetadata, {
      facebookPageKind: "EXTERNAL_PAGE",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("approval and content-use");
  });

  it("allows an external Page when approval metadata is recorded", () => {
    const result = validateMergedSourceUpdate(FACEBOOK_SOURCE, {
      facebookPageKind: "EXTERNAL_PAGE",
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects removing the Page URL", () => {
    const result = validateMergedSourceUpdate(FACEBOOK_SOURCE, {
      baseUrl: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("Page URL");
  });

  it("rejects an invalid Page ID/URL combination", () => {
    const result = validateMergedSourceUpdate(FACEBOOK_SOURCE, {
      facebookPageId: null,
      baseUrl: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("Page ID");
    expect(result.issues.join(" ")).toContain("Page URL");
  });

  it("rejects switching a non-Facebook source to FACEBOOK without metadata", () => {
    const website = {
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
    };
    const result = validateMergedSourceUpdate(website, {
      sourceType: "FACEBOOK",
    });
    expect(result.ok).toBe(false);
  });

  it("allows a normal non-Facebook partial update", () => {
    const website = {
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: null,
      facebookContentUseState: null,
    };
    expect(
      validateMergedSourceUpdate(website, {
        name: "Updated",
        checkFrequencyMinutes: 30,
      }),
    ).toEqual({ ok: true });
  });
});

describe("sourceInvariantIssues", () => {
  it("returns no issues for non-Facebook sources", () => {
    expect(
      sourceInvariantIssues({ sourceType: "WEBSITE", baseUrl: null }),
    ).toEqual([]);
  });

  it("requires the core Facebook fields", () => {
    expect(
      sourceInvariantIssues({
        sourceType: "FACEBOOK",
        baseUrl: null,
        facebookPageId: null,
        facebookPageKind: null,
      }),
    ).toHaveLength(3);
  });
});

describe("updateSourceSchema", () => {
  it("accepts a partial update", () => {
    const parsed = updateSourceSchema.safeParse({ name: "Renamed" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid check frequency", () => {
    const parsed = updateSourceSchema.safeParse({
      checkFrequencyMinutes: 1,
    });
    expect(parsed.success).toBe(false);
  });
});
