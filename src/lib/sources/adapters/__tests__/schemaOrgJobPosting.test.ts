import { describe, it, expect } from "vitest";
import {
  looksLikeJsonLd,
  parseSchemaOrgJobPostingBody,
} from "../schemaOrgJobPosting";

const CONTEXT = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceName: "Ethiopian Airlines",
  baseUrl: "https://www.ethiopianairlines.com/careers",
};

const POSTING = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "First Officer",
  description: "Operate our fleet safely.",
  datePosted: "2026-06-01T08:00:00.000Z",
  validThrough: "2026-07-01T00:00:00.000Z",
  employmentType: "FULL_TIME",
  hiringOrganization: {
    "@type": "Organization",
    name: "Ethiopian Airlines",
  },
  jobLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Addis Ababa",
      addressCountry: "ET",
    },
  },
  baseSalary: {
    "@type": "MonetaryAmount",
    currency: "ETB",
    value: { minValue: 50000, maxValue: 70000, unitText: "MONTH" },
  },
  experienceRequirements: { monthsOfExperience: 24 },
  educationRequirements: { credentialCategory: "Bachelor's degree" },
  applicantLocationRequirements: { "@type": "Country", name: "Ethiopia" },
  eligibility: "Open to Ethiopian applicants",
  identifier: { "@type": "PropertyValue", value: "job-1" },
  url: "https://www.ethiopianairlines.com/jobs/1",
};

describe("looksLikeJsonLd", () => {
  it("detects JSON-LD script blocks", () => {
    expect(
      looksLikeJsonLd(
        '<html><script type="application/ld+json">{}</script></html>',
      ),
    ).toBe(true);
    expect(looksLikeJsonLd("<html><body>No data</body></html>")).toBe(false);
  });
});

describe("parseSchemaOrgJobPostingBody", () => {
  it("maps a single JobPosting object", () => {
    const result = parseSchemaOrgJobPostingBody(
      JSON.stringify(POSTING),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.found).toBe(1);
    expect(result.jobs[0]).toMatchObject({
      title: "First Officer",
      organizationName: "Ethiopian Airlines",
      locationName: "Addis Ababa, ET",
      employmentType: "FULL_TIME",
      salaryRaw: "ETB 50000 - 70000",
      experienceRaw: "24 months",
      educationRequirements: "Bachelor's degree",
      applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
      applicationUrl: "https://www.ethiopianairlines.com/jobs/1",
      externalId: "job-1",
      sourceId: CONTEXT.sourceId,
    });
  });

  it("walks @graph and ignores unrelated structured data", () => {
    const document = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "Ethiopian Airlines" },
        { ...POSTING, "@type": "https://schema.org/JobPosting" },
      ],
    };

    const result = parseSchemaOrgJobPostingBody(
      JSON.stringify(document),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.found).toBe(1);
    expect(result.jobs[0].title).toBe("First Officer");
  });

  it("extracts JSON-LD blocks from an HTML page", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not valid json }</script>
      <script type="application/ld+json">${JSON.stringify(POSTING)}</script>
    </head><body></body></html>`;

    const result = parseSchemaOrgJobPostingBody(html, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toHaveLength(1);
  });

  it("drops a posting whose application URL is unsafe", () => {
    const result = parseSchemaOrgJobPostingBody(
      JSON.stringify({ ...POSTING, url: "javascript:alert(1)" }),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toEqual([]);
  });

  it("returns NOT_STATED when eligibility is not explicit", () => {
    const { applicantLocationRequirements, eligibility, ...posting } = POSTING;
    void applicantLocationRequirements;
    void eligibility;

    const result = parseSchemaOrgJobPostingBody(
      JSON.stringify(posting),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs[0].applicantEligibility).toBe("NOT_STATED");
  });

  it("fails safely for invalid JSON or missing JSON-LD", () => {
    expect(parseSchemaOrgJobPostingBody("{", CONTEXT)).toEqual({
      ok: false,
      error: "Invalid JSON response",
    });
    expect(
      parseSchemaOrgJobPostingBody("<html><body /></html>", CONTEXT),
    ).toEqual({ ok: false, error: "No JSON-LD data found" });
    expect(parseSchemaOrgJobPostingBody("", CONTEXT)).toEqual({
      ok: false,
      error: "Empty response",
    });
  });
});
