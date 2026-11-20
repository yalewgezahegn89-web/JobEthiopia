import { describe, expect, it } from "vitest";
import {
  buildArticleLd,
  buildJobPostingLd,
  serializeJsonLd,
} from "../structuredData";

const NOW = new Date("2026-03-01T00:00:00.000Z");
const CANONICAL = "https://jobethiopia.et/jobs/job-1";

function job(overrides: Record<string, unknown> = {}) {
  return {
    title: "Senior Accountant",
    description: "Prepare financial statements and manage ledgers.",
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: "2099-03-15T00:00:00.000Z",
    employmentType: "CONTRACT",
    organizationName: "ACME Plc",
    locationName: "Addis Ababa",
    status: "PUBLISHED",
    lastVerifiedAt: "2026-02-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildJobPostingLd", () => {
  it("emits only factual, schema-compatible fields", () => {
    const ld = buildJobPostingLd(job(), CANONICAL, NOW);

    expect(ld).toEqual({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Accountant",
      description: "Prepare financial statements and manage ledgers.",
      url: CANONICAL,
      datePosted: "2026-01-01T00:00:00.000Z",
      validThrough: "2099-03-15T00:00:00.000Z",
      employmentType: "CONTRACTOR",
      hiringOrganization: {
        "@type": "Organization",
        name: "ACME Plc",
      },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Addis Ababa",
        },
      },
    });
    expect(JSON.stringify(ld)).not.toContain("salary");
    expect(JSON.stringify(ld)).not.toContain("application");
  });

  it("omits structured data when a required rich-result fact is unavailable", () => {
    expect(
      buildJobPostingLd(job({ employmentType: null }), CANONICAL, NOW),
    ).toBeNull();
    expect(
      buildJobPostingLd(job({ organizationName: null }), CANONICAL, NOW),
    ).toBeNull();
    expect(
      buildJobPostingLd(job({ locationName: null }), CANONICAL, NOW),
    ).toBeNull();
    expect(buildJobPostingLd(job({ postedAt: null }), CANONICAL, NOW)).toBeNull();
  });

  it.each([
    ["draft", { status: "DRAFT" }],
    ["stale", { lastVerifiedAt: "2025-01-01T00:00:00.000Z" }],
    ["expired", { deadline: "2020-01-01T00:00:00.000Z" }],
    ["missing title", { title: "" }],
    ["missing description", { description: null }],
  ])("does not emit structured data for a %s job", (_name, overrides) => {
    expect(buildJobPostingLd(job(overrides), CANONICAL, NOW)).toBeNull();
  });
});

describe("buildArticleLd", () => {
  const article = {
    title: "How to Write a Strong CV",
    excerpt: "Practical tips for Ethiopian job seekers.",
    status: "PUBLISHED",
    publishedAt: "2026-02-10T00:00:00.000Z",
    category: "Resume",
  };

  it("emits Article data only from published metadata that exists", () => {
    expect(buildArticleLd(article, "https://jobethiopia.et/careers/article-1")).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "How to Write a Strong CV",
      mainEntityOfPage: "https://jobethiopia.et/careers/article-1",
      datePublished: "2026-02-10T00:00:00.000Z",
      publisher: {
        "@type": "Organization",
        name: "JobEthiopia",
      },
      description: "Practical tips for Ethiopian job seekers.",
      articleSection: "Resume",
    });
  });

  it("prefers the exact source instant over a display label", () => {
    const ld = buildArticleLd(
      {
        ...article,
        publishedAt: "Feb 10, 2026",
        publishedAtIso: "2026-02-10T23:30:00.000Z",
      },
      CANONICAL,
    );

    expect(ld).toMatchObject({ datePublished: "2026-02-10T23:30:00.000Z" });
  });

  it("returns null when the article is not published or has no usable date", () => {
    expect(buildArticleLd({ ...article, status: "DRAFT" }, CANONICAL)).toBeNull();
    expect(buildArticleLd({ ...article, publishedAt: null }, CANONICAL)).toBeNull();
  });
});

describe("serializeJsonLd", () => {
  it("escapes script-breaking characters", () => {
    const serialized = serializeJsonLd({ description: "<b>A & B</b>" });
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain("&");
    expect(serialized).toContain("\\u003cb\\u003e");
  });
});
