import { describe, it, expect } from "vitest";
import { extractFacebookJobPost } from "../extractJobPost";

const context = {
  sourceId: "source-1",
  pageId: "page-1",
  pageName: "Example Employer",
};

const completePost = {
  id: "post-1",
  created_time: "2026-01-02T10:00:00.000Z",
  permalink_url: "https://www.facebook.com/example/posts/1",
  message: [
    "Job Title: Senior Accountant",
    "Employer: Example Trading PLC",
    "Location: Addis Ababa",
    "Application Deadline: January 31, 2026",
    "Requirements: BA in Accounting and 5 years experience.",
    "How to apply: https://example.com/careers/senior-accountant",
  ].join("\n"),
};

describe("extractFacebookJobPost", () => {
  it("extracts a structured job post with explicit fields", () => {
    const result = extractFacebookJobPost(completePost, context);

    expect(result.kind).toBe("JOB");
    if (result.kind !== "JOB") return;

    expect(result.job).toMatchObject({
      title: "Senior Accountant",
      organizationName: "Example Trading PLC",
      locationName: "Addis Ababa",
      applicationUrl: "https://example.com/careers/senior-accountant",
      sourceId: "source-1",
      externalId: "page-1:post-1",
      sourceUrl: "https://www.facebook.com/example/posts/1",
      postedAt: "2026-01-02T10:00:00.000Z",
    });
    expect(result.job.deadline).toBe("2026-01-31T23:59:59.999Z");
    expect(result.job.description).toContain("Source: Example Employer");
    expect(result.job.description).toContain(
      "https://www.facebook.com/example/posts/1",
    );
  });

  it("skips posts with no job signal", () => {
    const result = extractFacebookJobPost(
      { id: "p", message: "Join our webinar on Friday!" },
      context,
    );
    expect(result.kind).toBe("NOT_A_JOB");
  });

  it("skips an announcement that is not a vacancy", () => {
    const result = extractFacebookJobPost(
      {
        id: "p",
        message: "Announcement: we are now hiring new products. Follow us!",
      },
      context,
    );
    expect(result.kind).toBe("NOT_A_JOB");
  });

  it("retains incomplete jobs as drafts with clear review reasons", () => {
    const result = extractFacebookJobPost(
      {
        id: "p2",
        message: [
          "We are hiring: Driver",
          "Send your CV to jobs@example.com",
        ].join("\n"),
      },
      context,
    );

    expect(result.kind).toBe("JOB");
    if (result.kind !== "JOB") return;

    expect(result.job.title).toBe("Driver");
    expect(result.job.organizationName).toBe("Example Employer");
    expect(result.job.applicationUrl).toBeNull();
    expect(result.job.deadline).toBeNull();
    expect(result.job.applicantEligibility).toBe("NOT_STATED");
    expect(result.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("application URL"),
        expect.stringContaining("deadline"),
        expect.stringContaining("eligibility"),
        expect.stringContaining("location"),
        expect.stringContaining("Category"),
      ]),
    );
  });

  it("never uses the Facebook permalink as the application URL", () => {
    const result = extractFacebookJobPost(
      {
        id: "p3",
        permalink_url: "https://www.facebook.com/example/posts/3",
        message: [
          "Vacancy: Cleaner",
          "Apply at https://www.facebook.com/example/posts/3",
        ].join("\n"),
      },
      context,
    );

    expect(result.kind).toBe("JOB");
    if (result.kind !== "JOB") return;
    expect(result.job.applicationUrl).toBeNull();
  });

  it("classifies explicit eligibility without inferring it", () => {
    const result = extractFacebookJobPost(
      {
        id: "p4",
        message: [
          "Position: Nurse",
          "Location: Addis Ababa",
          "Deadline: 2026-03-01",
          "Open to Ethiopian applicants only.",
          "Apply: https://example.com/nurse",
        ].join("\n"),
      },
      context,
    );

    expect(result.kind).toBe("JOB");
    if (result.kind !== "JOB") return;
    expect(result.job.applicantEligibility).toBe(
      "ETHIOPIAN_APPLICANTS_CONFIRMED",
    );
    expect(result.reviewReasons).not.toEqual(
      expect.arrayContaining([expect.stringContaining("eligibility")]),
    );
  });

  it("parses day-first dates deterministically", () => {
    const result = extractFacebookJobPost(
      {
        id: "p5",
        message: [
          "Job Title: Clerk",
          "Deadline: 15/02/2026",
          "Apply: https://example.com/clerk",
        ].join("\n"),
      },
      context,
    );

    expect(result.kind).toBe("JOB");
    if (result.kind !== "JOB") return;
    expect(result.job.deadline).toBe("2026-02-15T23:59:59.999Z");
  });
});
