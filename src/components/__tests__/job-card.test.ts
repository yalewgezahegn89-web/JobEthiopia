import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import JobCard from "@/components/job-card";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    organizationName: "ACME Plc",
    locationName: "Addis Ababa",
    categoryName: "Finance",
    professionName: "Accounting",
    employmentType: "FULL_TIME",
    salaryText: "30,000 - 45,000 ETB",
    deadlineText: "Mar 15, 2099",
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: "2099-03-15T00:00:00.000Z",
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
    ...overrides,
};
}

function render(job: ReturnType<typeof makeJob>): string {
  return renderToStaticMarkup(createElement(JobCard, { job }));
}

describe("JobCard", () => {
  it("renders the job title as a link to the job detail page", () => {
    const html = render(makeJob());
    expect(html).toContain("Senior Accountant");
    expect(html).toContain('href="/jobs/job-1"');
  });

  it("renders organization identity with initials mark", () => {
    const html = render(makeJob());
    expect(html).toContain("ACME Plc");
    expect(html).toContain("AC");
  });

  it("renders location metadata", () => {
    const html = render(makeJob());
    expect(html).toContain("Addis Ababa");
  });

  it("renders profession, category, and employment type badges", () => {
    const html = render(makeJob());
    expect(html).toContain("Accounting");
    expect(html).toContain("Finance");
    expect(html).toContain("FULL TIME");
  });

  it("renders salary and deadline", () => {
    const html = render(makeJob());
    expect(html).toContain("30,000 - 45,000 ETB");
    expect(html).toContain("Deadline:");
    expect(html).toContain("Mar 15, 2099");
  });

  it("shows a Verified badge when verificationStatus is VERIFIED", () => {
    const html = render(makeJob());
    expect(html).toContain("Verified");
  });

  it("does not show Verified when not verified", () => {
    const html = render(makeJob({ verificationStatus: null }));
    expect(html).not.toContain("Verified");
  });

  it("applies an amber closing-soon treatment for jobs closing within 7 days", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const html = render(makeJob({ deadline: future }));
    expect(html).toContain("Closing soon");
    expect(html).toContain("bg-accent");
  });

  it("applies a destructive treatment for expired jobs", () => {
    const html = render(makeJob({ deadline: "2020-01-01T00:00:00.000Z" }));
    expect(html).toContain("Expired");
    expect(html).toContain("bg-destructive");
  });

  it("applies a primary accent for normal open jobs", () => {
    const html = render(
      makeJob({ deadline: "2099-01-01T00:00:00.000Z", status: "PUBLISHED" }),
    );
    expect(html).toContain("bg-primary");
  });

  it("handles missing optional fields gracefully", () => {
    const html = render(
      makeJob({
        organizationName: null,
        locationName: null,
        categoryName: null,
        professionName: null,
        employmentType: null,
        salaryText: null,
        deadlineText: null,
        deadline: null,
        verificationStatus: null,
      }),
    );
    expect(html).toContain("Senior Accountant");
    expect(html).not.toContain("undefined");
  });

  it("uses a fallback brand mark when no organization name is present", () => {
    const html = render(makeJob({ organizationName: null }));
    expect(html).not.toContain("AC");
  });
});
