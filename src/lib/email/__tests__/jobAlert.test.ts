import { describe, it, expect } from "vitest";
import { buildJobAlertEmail } from "@/lib/email/jobAlert";
import type { MatchedJob } from "@/lib/jobAlerts/matching";

function job(overrides: Partial<MatchedJob> = {}): MatchedJob {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: 'Senior "Auditor" & Analyst',
    slug: "senior-auditor",
    organizationId: "org-1",
    organizationName: "ACME <Co>",
    locationId: "loc-1",
    locationName: "Addis Ababa",
    employmentType: "FULL_TIME",
    description: "<b>IFRS</b> experience",
    postedAt: new Date("2026-09-01T08:00:00.000Z"),
    deadline: null,
    ...overrides,
  };
}

const NOTIFICATION = {
  alertName: 'My "Alert"',
  keywords: "auditor, IFRS",
  jobs: [job()],
  baseUrl: "https://app.example.com",
  unsubscribeUrl:
    "https://app.example.com/api/job-alerts/unsubscribe?token=abc123&locale=en",
};

describe("buildJobAlertEmail", () => {
  it("builds an English email with subject, links, and escaped content", () => {
    const email = buildJobAlertEmail("en", NOTIFICATION);
    expect(email.to).toBe("");
    expect(email.subject).toContain('My "Alert"');
    expect(email.text).toContain('Senior "Auditor" & Analyst');
    expect(email.text).toContain("https://app.example.com/jobs/11111111-1111-4111-8111-111111111111");
    expect(email.text).toContain(NOTIFICATION.unsubscribeUrl);
  });

  it("escapes HTML in job and alert content", () => {
    const email = buildJobAlertEmail("en", NOTIFICATION);
    expect(email.text).not.toContain("<b>");
    expect(email.html).toContain("Senior &quot;Auditor&quot; &amp; Analyst");
    expect(email.html).toContain("ACME &lt;Co&gt;");
  });

  it("localizes subject and labels per locale", () => {
    const en = buildJobAlertEmail("en", NOTIFICATION);
    const am = buildJobAlertEmail("am", NOTIFICATION);
    const om = buildJobAlertEmail("om", NOTIFICATION);

    expect(en.subject).toContain("New jobs");
    expect(am.subject).toContain("አዲስ ስራዎች");
    expect(om.subject).toContain("Hojiilee haaraa");

    expect(om.text).toContain("Hambisaa");
    expect(am.text).toContain("ከደንበኝነት");
  });

  it("includes a job count label and no-keywords fallback", () => {
    const email = buildJobAlertEmail("am", {
      ...NOTIFICATION,
      keywords: null,
      jobs: [job(), job({ id: "22222222-2222-4222-8222-222222222222" })],
    });
    expect(email.text).toContain("2");
    expect(email.html).toContain("ምንም ቁልፍ ቃላት");
  });

  it("embeds the unsubscribe URL (token is capability, not a stored secret)", () => {
    const email = buildJobAlertEmail("en", NOTIFICATION);
    expect(email.text).toContain(NOTIFICATION.unsubscribeUrl);
    expect(email.html).toContain(
      "https://app.example.com/api/job-alerts/unsubscribe?token=abc123&amp;locale=en",
    );
  });
});