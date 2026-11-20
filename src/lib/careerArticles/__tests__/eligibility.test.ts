import { describe, it, expect } from "vitest";
import { isArticlePubliclyEligible } from "../eligibility";

const NOW = new Date("2026-11-20T12:00:00.000Z");

describe("isArticlePubliclyEligible", () => {
  it("allows PUBLISHED with a past publishedAt", () => {
    expect(
      isArticlePubliclyEligible(
        {
          status: "PUBLISHED",
          publishedAt: "2026-01-20T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("allows PUBLISHED with publishedAt equal to the current time", () => {
    expect(
      isArticlePubliclyEligible(
        { status: "PUBLISHED", publishedAt: NOW.toISOString() },
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects PUBLISHED with a future publishedAt", () => {
    expect(
      isArticlePubliclyEligible(
        {
          status: "PUBLISHED",
          publishedAt: "2026-11-20T12:00:00.001Z",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects PUBLISHED with a null publishedAt", () => {
    expect(
      isArticlePubliclyEligible(
        { status: "PUBLISHED", publishedAt: null },
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects an unparseable publishedAt", () => {
    expect(
      isArticlePubliclyEligible(
        { status: "PUBLISHED", publishedAt: "not-a-date" },
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects an unpublished article even with a past publishedAt", () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "ARCHIVED", "REMOVED"]) {
      expect(
        isArticlePubliclyEligible(
          { status, publishedAt: "2026-01-20T00:00:00.000Z" },
          NOW,
        ),
      ).toBe(false);
    }
  });
});
