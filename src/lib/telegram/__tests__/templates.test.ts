import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildTelegramJobMessage,
  buildTelegramPublicationText,
  escapeTelegramHtml,
  jobPublicUrl,
  plainText,
  renderTelegramMessage,
  type TelegramJobInput,
} from "../templates";

const JOB: TelegramJobInput = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "First Officer",
  description: "Operate our fleet safely.",
  organizationName: "Ethiopian Airlines",
  locationName: "Addis Ababa",
  employmentType: "FULL_TIME",
  deadline: new Date("2026-07-01T00:00:00.000Z"),
  applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("escapeTelegramHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeTelegramHtml(`<b>"A & B" 'x'</b>`)).toBe(
      "&lt;b&gt;&quot;A &amp; B&quot; &#39;x&#39;&lt;/b&gt;",
    );
  });
});

describe("plainText", () => {
  it("strips markup, scripts and styles and decodes entities", () => {
    expect(
      plainText(
        "<script>alert(1)</script><style>.x{}</style><p>Hello&nbsp;<strong>world</strong> &amp; friends</p>",
      ),
    ).toBe("Hello world & friends");
  });
});

describe("telegram job messages", () => {
  it("builds an escaped message with eligibility and job URL", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.example.com/");

    const message = buildTelegramJobMessage({
      ...JOB,
      title: "<b>First</b>",
      organizationName: "A & B",
      description: '<script>bad()</script><p>Hello <strong>world</strong></p>',
    });

    expect(message).toContain("<b>&lt;b&gt;First&lt;/b&gt;</b>");
    expect(message).toContain("A &amp; B");
    expect(message).toContain("Hello world");
    expect(message).not.toContain("<script>");
    expect(message).not.toContain("<p>");
    expect(message).toContain("Eligibility: Ethiopian applicants confirmed");
    expect(message).toContain(
      'href="https://jobs.example.com/jobs/11111111-1111-4111-8111-111111111111"',
    );
  });

  it("preserves the official English description and qualifications", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.example.com");
    const description =
      "Operate our fleet safely. Qualifications: valid ATPL, 1,500 flight hours, and a Class 1 medical certificate.";

    const text = buildTelegramPublicationText({ ...JOB, description });

    expect(text.title).toBe("First Officer");
    expect(text.description).toBe(description);

    const rendered = renderTelegramMessage(text);
    expect(rendered).toContain(
      "Qualifications: valid ATPL, 1,500 flight hours, and a Class 1 medical certificate.",
    );
  });

  it("uses English-only headings and labels", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.example.com");
    const rendered = renderTelegramMessage(buildTelegramPublicationText(JOB));

    expect(rendered).toContain("Location: Addis Ababa");
    expect(rendered).toContain("Type: FULL TIME");
    expect(rendered).toContain("Eligibility: Ethiopian applicants confirmed");
    expect(rendered).toContain("Deadline: 1 Jul 2026");
    expect(rendered).toContain("View job and apply");
  });

  it("truncates long descriptions to the excerpt limit", () => {
    const text = buildTelegramPublicationText({
      ...JOB,
      description: "a".repeat(600),
    });
    expect(text.description).toBe(`${"a".repeat(500)}...`);
    expect(text.description).not.toContain("a".repeat(501));
  });

  it("includes location, type and formatted deadline", () => {
    const text = buildTelegramPublicationText(JOB);
    expect(text).toMatchObject({
      organizationName: "Ethiopian Airlines",
      locationName: "Addis Ababa",
      employmentType: "FULL TIME",
      eligibility: "Ethiopian applicants confirmed",
    });
    expect(text.deadline).toBe("1 Jul 2026");

    const rendered = renderTelegramMessage(text);
    expect(rendered).toContain("Location: Addis Ababa");
    expect(rendered).toContain("Type: FULL TIME");
    expect(rendered).toContain("Deadline: 1 Jul 2026");
  });

  it("builds the public URL from APP_BASE_URL", () => {
    vi.stubEnv("APP_BASE_URL", "https://jobs.example.com/");
    expect(jobPublicUrl("job-1")).toBe(
      "https://jobs.example.com/jobs/job-1",
    );
  });
});
