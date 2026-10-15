import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { CvDocument, formatYearMonth } from "@/components/cv/cv-document";
import type { CvAggregate } from "@/lib/cv/dal";

const labels = {
  summary: "Professional Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  phone: "Phone",
  location: "Location",
  website: "Website",
  present: "Present",
};

function makeCv(overrides?: Partial<CvAggregate>): CvAggregate {
  return {
    header: {
      id: "hdr-1",
      candidateId: "user-1",
      title: "Senior Software Engineer",
      professionalSummary: "Experienced engineer with 10+ years.",
      phone: "+251911223344",
      location: "Addis Ababa",
      websiteUrl: "https://example.com",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
    experiences: [
      {
        id: "exp-1",
        employer: "ACME Corp",
        role: "Lead Engineer",
        location: "Addis Ababa",
        startMonth: "2022-06",
        endMonth: null,
        description: "Led the backend team.",
      },
    ],
    educations: [
      {
        id: "edu-1",
        institution: "Addis Ababa University",
        qualification: "BSc",
        fieldOfStudy: "Computer Science",
        startMonth: "2012-09",
        endMonth: "2016-06",
      },
    ],
    skills: [
      { id: "sk-1", name: "TypeScript", level: "Expert" },
      { id: "sk-2", name: "React", level: null },
    ],
    certifications: [
      {
        id: "cert-1",
        name: "AWS Solutions Architect",
        issuer: "Amazon",
        issuedMonth: "2023-03",
        credentialUrl: "https://aws.amazon.com/verify/abc",
      },
    ],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  formatYearMonth                                                    */
/* ------------------------------------------------------------------ */

describe("formatYearMonth", () => {
  it("returns empty string for null", () => {
    expect(formatYearMonth(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatYearMonth(undefined)).toBe("");
  });

  it("formats '2020-01' as 'Jan 2020'", () => {
    expect(formatYearMonth("2020-01")).toBe("Jan 2020");
  });

  it("formats '2099-12' as 'Dec 2099'", () => {
    expect(formatYearMonth("2099-12")).toBe("Dec 2099");
  });

  it("returns raw string for invalid input", () => {
    expect(formatYearMonth("abc")).toBe("abc");
  });
});

/* ------------------------------------------------------------------ */
/*  CvDocument – header                                                */
/* ------------------------------------------------------------------ */

function renderCv(cvOverrides?: Partial<CvAggregate>, name = "Abebe Kebede", email: string | null = "abebe@example.com") {
  const cv = makeCv(cvOverrides);
  const html = renderToStaticMarkup(
    React.createElement(CvDocument, { name, email, cv, labels }),
  );
  return html;
}

describe("CvDocument", () => {
  it("renders name as h1", () => {
    const html = renderCv();
    expect(html).toContain("<h1");
    expect(html).toContain("Abebe Kebede");
  });

  it("renders title when provided", () => {
    const html = renderCv();
    expect(html).toContain("Senior Software Engineer");
  });

  it("does not render title when header.title is empty", () => {
    const html = renderCv({
      header: { ...makeCv().header, title: "" },
    });
    expect(html).not.toContain("<p className=\"mt-1 text-xl");
  });

  it("renders email when provided", () => {
    const html = renderCv();
    expect(html).toContain("abebe@example.com");
  });

  it("does not render email when null", () => {
    const html = renderCv({}, "Abebe", null);
    expect(html).not.toContain("abebe@example.com");
  });

  it("renders phone and location in contact line", () => {
    const html = renderCv();
    expect(html).toContain("+251911223344");
    expect(html).toContain("Addis Ababa");
  });

  it("renders website link with correct href", () => {
    const html = renderCv();
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("https://example.com");
  });

  it("does not render website section when websiteUrl is null", () => {
    const html = renderCv({
      header: { ...makeCv().header, websiteUrl: null },
    });
    expect(html).not.toContain('href="https://example.com"');
  });

  it("renders professional summary when present", () => {
    const html = renderCv();
    expect(html).toContain("Professional Summary");
    expect(html).toContain("Experienced engineer with 10+ years.");
  });

  it("hides professional summary section when null", () => {
    const html = renderCv({
      header: { ...makeCv().header, professionalSummary: null },
    });
    expect(html).not.toContain("Professional Summary");
  });
});

/* ------------------------------------------------------------------ */
/*  CvDocument – experiences                                           */
/* ------------------------------------------------------------------ */

describe("CvDocument – experiences", () => {
  it("renders experience entries with employer, role, and date range", () => {
    const html = renderCv();
    expect(html).toContain("Experience");
    expect(html).toContain("Lead Engineer");
    expect(html).toContain("ACME Corp");
    expect(html).toContain("Jun 2022");
  });

  it("renders experience description", () => {
    const html = renderCv();
    expect(html).toContain("Led the backend team.");
  });

  it("shows 'Present' label for entries with no endMonth", () => {
    const html = renderCv();
    expect(html).toContain("Present");
  });

  it("uses formatYearMonth in date ranges with endMonth", () => {
    const cv = makeCv({
      experiences: [
        { ...makeCv().experiences[0], endMonth: "2024-01" },
      ],
    });
    const html = renderToStaticMarkup(
      React.createElement(CvDocument, { name: "Abebe", email: "a@b.com", cv, labels }),
    );
    expect(html).toContain("Jan 2024");
    expect(html).not.toContain("Present");
  });

  it("does not render experience section when empty", () => {
    const html = renderCv({ experiences: [] });
    expect(html).not.toContain('>Experience</h2>');
  });
});

/* ------------------------------------------------------------------ */
/*  CvDocument – educations                                            */
/* ------------------------------------------------------------------ */

describe("CvDocument – educations", () => {
  it("renders education entries with institution, qualification, and fieldOfStudy", () => {
    const html = renderCv();
    expect(html).toContain("Education");
    expect(html).toContain("Addis Ababa University");
    expect(html).toContain("BSc");
    expect(html).toContain("Computer Science");
  });

  it("renders education date range", () => {
    const html = renderCv();
    expect(html).toContain("Sep 2012");
    expect(html).toContain("Jun 2016");
  });

  it("does not render education section when empty", () => {
    const html = renderCv({ educations: [] });
    expect(html).not.toContain("Education");
  });
});

/* ------------------------------------------------------------------ */
/*  CvDocument – skills                                                */
/* ------------------------------------------------------------------ */

describe("CvDocument – skills", () => {
  it("renders skills as list items with name", () => {
    const html = renderCv();
    expect(html).toContain("Skills");
    expect(html).toContain("TypeScript");
    expect(html).toContain("React");
  });

  it("renders skill level when present", () => {
    const html = renderCv();
    expect(html).toContain("Expert");
  });

  it("renders skill without level when level is null", () => {
    const cv = makeCv({
      skills: [{ id: "sk-1", name: "Node.js", level: null }],
    });
    const html = renderToStaticMarkup(
      React.createElement(CvDocument, { name: "Abebe", email: "a@b.com", cv, labels }),
    );
    expect(html).toContain("Node.js");
    expect(html).not.toContain("Node.js —");
  });

  it("does not render skills section when empty", () => {
    const html = renderCv({ skills: [] });
    expect(html).not.toContain("Skills");
  });
});

/* ------------------------------------------------------------------ */
/*  CvDocument – certifications                                        */
/* ------------------------------------------------------------------ */

describe("CvDocument – certifications", () => {
  it("renders certification name, issuer, and date", () => {
    const html = renderCv();
    expect(html).toContain("Certifications");
    expect(html).toContain("AWS Solutions Architect");
    expect(html).toContain("Amazon");
    expect(html).toContain("Mar 2023");
  });

  it("renders credentialUrl as a link with correct href", () => {
    const html = renderCv();
    expect(html).toContain('href="https://aws.amazon.com/verify/abc"');
  });

  it("does not render credentialUrl link when null", () => {
    const cv = makeCv({
      certifications: [
        { ...makeCv().certifications[0], credentialUrl: null },
      ],
    });
    const html = renderToStaticMarkup(
      React.createElement(CvDocument, { name: "Abebe", email: "a@b.com", cv, labels }),
    );
    expect(html).not.toContain("verify/abc");
  });

  it("does not render certifications section when empty", () => {
    const html = renderCv({ certifications: [] });
    expect(html).not.toContain("Certifications");
  });
});

/* ------------------------------------------------------------------ */
/*  Empty sections                                                     */
/* ------------------------------------------------------------------ */

describe("CvDocument – empty sections", () => {
  it("does not render any section heading when all sections are empty", () => {
    const html = renderCv({
      experiences: [],
      educations: [],
      skills: [],
      certifications: [],
      header: { ...makeCv().header, professionalSummary: null },
    });
    expect(html).not.toContain("Professional Summary");
    expect(html).not.toContain("Experience");
    expect(html).not.toContain("Education");
    expect(html).not.toContain("Skills");
    expect(html).not.toContain("Certifications");
  });
});

/* ------------------------------------------------------------------ */
/*  XSS / escaping                                                     */
/* ------------------------------------------------------------------ */

describe("CvDocument – XSS safety", () => {
  it("escapes HTML in summary text (no raw script tag rendered)", () => {
    const cv = makeCv({
      header: {
        ...makeCv().header,
        professionalSummary: "<script>alert('x')</script>",
      },
    });
    const html = renderToStaticMarkup(
      React.createElement(CvDocument, { name: "Abebe", email: "a@b.com", cv, labels }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;/script&gt;");
  });

  it("escapes HTML in experience description", () => {
    const cv = makeCv({
      experiences: [
        { ...makeCv().experiences[0], description: "<img src=x onerror=alert(1)>" },
      ],
    });
    const html = renderToStaticMarkup(
      React.createElement(CvDocument, { name: "Abebe", email: "a@b.com", cv, labels }),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

/* ------------------------------------------------------------------ */
/*  Aria labels                                                        */
/* ------------------------------------------------------------------ */

describe("CvDocument – aria-labels", () => {
  it("article has correct aria-label with name", () => {
    const html = renderCv();
    expect(html).toContain('aria-label="Curriculum vitae of Abebe Kebede"');
  });

  it("summary section has aria-label", () => {
    const html = renderCv();
    expect(html).toContain('aria-label="Professional Summary"');
  });

  it("experience section has aria-label", () => {
    const html = renderCv();
    expect(html).toContain('aria-label="Experience"');
  });

  it("education section has aria-label", () => {
    const html = renderCv();
    expect(html).toContain('aria-label="Education"');
  });

  it("skills section has aria-label", () => {
    const html = renderCv();
    expect(html).toContain('aria-label="Skills"');
  });

  it("certifications section has aria-label", () => {
    const html = renderCv();
    expect(html).toContain('aria-label="Certifications"');
  });
});
