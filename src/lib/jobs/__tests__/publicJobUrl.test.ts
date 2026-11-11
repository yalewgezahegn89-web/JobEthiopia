import { describe, expect, it } from "vitest";
import {
  buildPublicJobUrl,
  isPublicJobUrl,
  PUBLIC_SITE_ORIGIN,
} from "@/lib/jobs/publicJobUrl";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

describe("buildPublicJobUrl", () => {
  it("always uses the official public domain and job path", () => {
    expect(buildPublicJobUrl(JOB_ID)).toBe(
      `https://jobethiopia.et/jobs/${JOB_ID}`,
    );
    expect(PUBLIC_SITE_ORIGIN).toBe("https://jobethiopia.et");
  });

  it("is independent of APP_BASE_URL and the current deployment host", () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL =
      "https://jobethiopia-git-feature-example.vercel.app";
    try {
      expect(buildPublicJobUrl(JOB_ID)).toBe(
        `https://jobethiopia.et/jobs/${JOB_ID}`,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.APP_BASE_URL;
      } else {
        process.env.APP_BASE_URL = previous;
      }
    }
  });

  it("encodes the job id as a single path segment", () => {
    expect(buildPublicJobUrl("a/b c")).toBe(
      "https://jobethiopia.et/jobs/a%2Fb%20c",
    );
  });

  it("rejects an empty job id", () => {
    expect(() => buildPublicJobUrl("   ")).toThrow();
  });
});

describe("isPublicJobUrl", () => {
  it("accepts the canonical public job URL", () => {
    expect(isPublicJobUrl(`https://jobethiopia.et/jobs/${JOB_ID}`)).toBe(true);
    expect(
      isPublicJobUrl(`https://jobethiopia.et:443/jobs/${JOB_ID}`),
    ).toBe(true);
  });

  it.each([
    ["plaintext HTTP", `http://jobethiopia.et/jobs/${JOB_ID}`],
    ["a lookalike host", `https://jobethiopia.et.evil.example/jobs/${JOB_ID}`],
    ["a different host", `https://example.com/jobs/${JOB_ID}`],
    ["credentials", `https://user:pass@jobethiopia.et/jobs/${JOB_ID}`],
    ["an alternate port", `https://jobethiopia.et:8443/jobs/${JOB_ID}`],
    ["a query string", `https://jobethiopia.et/jobs/${JOB_ID}?x=1`],
    ["a fragment", `https://jobethiopia.et/jobs/${JOB_ID}#apply`],
    ["a non-job path", "https://jobethiopia.et/about"],
    ["a nested job path", `https://jobethiopia.et/jobs/${JOB_ID}/apply`],
    ["an empty job path", "https://jobethiopia.et/jobs/"],
  ])("rejects %s", (_label, value) => {
    expect(isPublicJobUrl(value)).toBe(false);
  });

  it("rejects empty and unparseable values", () => {
    expect(isPublicJobUrl(null)).toBe(false);
    expect(isPublicJobUrl("")).toBe(false);
    expect(isPublicJobUrl("not a url")).toBe(false);
  });
});
