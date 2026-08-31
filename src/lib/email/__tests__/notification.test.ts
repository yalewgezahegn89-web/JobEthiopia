import { describe, it, expect } from "vitest";
import { buildApplicationStatusEmail } from "@/lib/email/notification";
import type { ApplicationStatusNotification } from "@/lib/email/notification";
import { buildApplicationSubmissionEmail } from "@/lib/email/notification";
import type { ApplicationSubmissionNotification } from "@/lib/email/notification";

const BASE_URL = "https://jobs.example.com";

function makeNotification(overrides?: Partial<ApplicationStatusNotification>): ApplicationStatusNotification {
  return {
    applicationId: "11111111-1111-4111-8111-111111111111",
    candidateEmail: "candidate@example.com",
    candidateName: "Abebe",
    jobTitle: "Software Engineer",
    organizationName: "EthioTech",
    newStatus: "REVIEWING",
    ...overrides,
  };
}

function makeSubmission(
  overrides?: Partial<ApplicationSubmissionNotification>,
): ApplicationSubmissionNotification {
  return {
    applicationId: "11111111-1111-4111-8111-111111111111",
    candidateName: "Abebe",
    jobTitle: "Software Engineer",
    organizationName: "EthioTech",
    submittedAt: "2026-08-31T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildApplicationStatusEmail", () => {
  it("builds a REVIEWING email with correct subject and text", () => {
    const email = buildApplicationStatusEmail(BASE_URL, makeNotification());
    expect(email.to).toBe("candidate@example.com");
    expect(email.subject).toContain("REVIEWING");
    expect(email.subject).toContain("Software Engineer");
    expect(email.text).toContain("under review");
    expect(email.text).toContain("EthioTech");
    expect(email.text).toContain(`${BASE_URL}/applications/11111111-1111-4111-8111-111111111111`);
  });

  it("builds a SHORTLISTED email", () => {
    const email = buildApplicationStatusEmail(BASE_URL, makeNotification({ newStatus: "SHORTLISTED" }));
    expect(email.subject).toContain("SHORTLISTED");
    expect(email.text).toContain("shortlisted");
  });

  it("builds a REJECTED email", () => {
    const email = buildApplicationStatusEmail(BASE_URL, makeNotification({ newStatus: "REJECTED" }));
    expect(email.subject).toContain("REJECTED");
    expect(email.text).toContain("not selected");
  });

  it("HTML-escapes user-supplied values", () => {
    const email = buildApplicationStatusEmail(
      BASE_URL,
      makeNotification({
        candidateName: 'Script<alert>("xss")',
        jobTitle: 'Title" onmouseover="alert(1)',
        organizationName: "Org & Co",
      }),
    );
    expect(email.html).not.toContain("<alert>");
    expect(email.html).toContain("&lt;alert&gt;");
    expect(email.html).toContain("&amp; Co");
    expect(email.html).toContain("&quot;");
  });

  it("does not include candidate email, cover letter, or internal IDs", () => {
    const email = buildApplicationStatusEmail(BASE_URL, makeNotification());
    expect(email.text).not.toContain("candidate@example.com");
    expect(email.html).not.toContain("candidate@example.com");
    expect(email.text).not.toContain("cover letter");
    expect(email.html).not.toContain("cover letter");
  });

  it("includes a clickable link to the application detail page", () => {
    const email = buildApplicationStatusEmail(BASE_URL, makeNotification());
    expect(email.html).toContain(`${BASE_URL}/applications/11111111-1111-4111-8111-111111111111`);
  });

  it("uses the provided APP_BASE_URL", () => {
    const email = buildApplicationStatusEmail("https://other.example.com", makeNotification());
    expect(email.text).toContain("https://other.example.com/applications/11111111-1111-4111-8111-111111111111");
  });
});

describe("buildApplicationSubmissionEmail", () => {
  it("builds an application submission email with subject and body", () => {
    const email = buildApplicationSubmissionEmail(BASE_URL, makeSubmission());
    expect(email.subject).toContain("Software Engineer");
    expect(email.subject).toContain("submitted");
    expect(email.text).toContain("Abebe");
    expect(email.text).toContain("Software Engineer");
    expect(email.text).toContain("EthioTech");
  });

  it("contains the submission date", () => {
    const email = buildApplicationSubmissionEmail(BASE_URL, makeSubmission());
    expect(email.text).toContain("August 31, 2026");
    expect(email.html).toContain("August 31, 2026");
  });

  it("contains the exact /applications/{id} URL", () => {
    const email = buildApplicationSubmissionEmail(BASE_URL, makeSubmission());
    expect(email.text).toContain(`${BASE_URL}/applications/11111111-1111-4111-8111-111111111111`);
    expect(email.html).toContain(`${BASE_URL}/applications/11111111-1111-4111-8111-111111111111`);
  });

  it("HTML-escapes user-supplied values", () => {
    const email = buildApplicationSubmissionEmail(
      BASE_URL,
      makeSubmission({
        candidateName: 'Abebe<script>alert("xss")</script>',
        jobTitle: 'Title" onmouseover="alert(1)',
        organizationName: "Org & Co",
      }),
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&amp; Co");
    expect(email.html).toContain("&quot;");
  });

  it("does not include a cover letter", () => {
    const email = buildApplicationSubmissionEmail(BASE_URL, makeSubmission());
    expect(email.text).not.toContain("cover letter");
    expect(email.html).not.toContain("cover letter");
  });

  it("does not include tokens or secrets", () => {
    const email = buildApplicationSubmissionEmail(BASE_URL, makeSubmission());
    const raw = `${email.subject} ${email.text} ${email.html}`;
    expect(raw).not.toContain("token");
    expect(raw).not.toContain("secret");
    expect(raw).not.toContain("api_key");
  });
});
