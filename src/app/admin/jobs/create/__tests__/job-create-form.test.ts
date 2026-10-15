import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockCreateCuratedJob: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/admin/curatedJobs", () => ({
  createCuratedJob: (...args: unknown[]) => mocks.mockCreateCuratedJob(...args),
}));

import JobCreateForm from "@/app/admin/jobs/create/job-create-form";
import type { CreateCuratedJobActionResult } from "../../actions";

const OPTIONS = {
  organizations: [{ id: "org-1", name: "ABC Corp" }],
  categories: [{ id: "cat-1", name: "Finance" }],
  professions: [{ id: "prof-1", name: "Accountant" }],
  locations: [{ id: "loc-1", name: "Addis Ababa" }],
};

function renderForm(initialState?: CreateCuratedJobActionResult) {
  return renderToStaticMarkup(
    createElement(JobCreateForm, { ...OPTIONS, ...(initialState ? { initialState } : {}) }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JobCreateForm — required identity fields", () => {
  it("renders organization, title and description inputs with labels", () => {
    const html = renderForm();
    expect(html).toContain('id="organizationId"');
    expect(html).toContain('id="title"');
    expect(html).toContain('id="description"');
    expect(html).toContain("<label");
  });

  it("renders the submit button as Create Draft", () => {
    const html = renderForm();
    expect(html).toContain("Create Draft");
  });

  it("accepts normal Unicode text in the title placeholder (Amharic)", () => {
    const html = renderForm();
    expect(html).toContain("ከፍተኛ");
  });
});

describe("JobCreateForm — selectors", () => {
  it("renders organization options from loaded data", () => {
    const html = renderForm();
    expect(html).toContain('value="org-1"');
    expect(html).toContain("ABC Corp");
  });

  it("renders category, profession and location selectors", () => {
    const html = renderForm();
    expect(html).toContain('id="categoryId"');
    expect(html).toContain('id="professionId"');
    expect(html).toContain('id="locationId"');
    expect(html).toContain('value="cat-1"');
    expect(html).toContain('value="prof-1"');
    expect(html).toContain('value="loc-1"');
  });

  it("renders all employment type options", () => {
    const html = renderForm();
    for (const value of ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "VOLUNTEER", "FREELANCE", "OTHER"]) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  it("renders all salary period options", () => {
    const html = renderForm();
    for (const value of ["HOURLY", "DAILY", "MONTHLY", "YEARLY", "OTHER"]) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  it("renders experience, salary, deadline and application URL inputs", () => {
    const html = renderForm();
    for (const id of ["experienceMin", "experienceMax", "salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod", "deadline", "applicationUrl"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("renders the additional detail textareas", () => {
    const html = renderForm();
    for (const id of ["responsibilities", "requirements", "educationRequirements", "benefits"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});

describe("JobCreateForm — provenance/safety", () => {
  it("does not expose a sourceId field", () => {
    const html = renderForm();
    expect(html).not.toContain('name="sourceId"');
    expect(html).not.toContain('name="source"');
    expect(html).not.toContain("Manual Entry");
  });

  it("does not expose verificationStatus, status, or postedAt fields", () => {
    const html = renderForm();
    expect(html).not.toContain('name="verificationStatus"');
    expect(html).not.toContain('name="status"');
    expect(html).not.toContain('name="postedAt"');
  });

  it("communicates that creation produces a DRAFT", () => {
    const html = renderForm();
    expect(html).toContain("DRAFT");
    expect(html).toContain("PENDING");
  });
});

describe("JobCreateForm — validation error association", () => {
  it("associates field errors via aria-describedby and renders them", () => {
    const html = renderForm({
      ok: false,
      fieldErrors: { title: ["Title is required"] },
    });
    expect(html).toContain("aria-invalid");
    expect(html).toContain('aria-describedby="title-error"');
    expect(html).toContain('id="title-error"');
    expect(html).toContain("Title is required");
  });

  it("renders a top-level server error with role=alert", () => {
    const html = renderForm({
      ok: false,
      error: "Unable to create this job. Please try again.",
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Unable to create this job.");
  });
});

describe("JobCreateForm — duplicate warning after creation", () => {
  it("renders the warning and a link to the created job", () => {
    const html = renderForm({
      ok: true,
      itemId: "44444444-4444-4444-8444-444444444444",
      warning: {
        code: "POSSIBLE_DUPLICATE",
        message: "Possible duplicate — review existing jobs before publishing.",
        matchedJobId: "66666666-6666-4666-8666-666666666666",
        matchedJobTitle: "Senior Accountant",
        matchedStatus: "PUBLISHED",
      },
    });
    expect(html).toContain("Possible duplicate — review existing jobs before publishing.");
    expect(html).toContain("Senior Accountant");
    expect(html).toContain("PUBLISHED");
    expect(html).toContain('href="/admin/jobs/44444444-4444-4444-8444-444444444444"');
    expect(html).toContain("View created job");
  });

  it("does not render the warning banner without a warning", () => {
    const html = renderForm({ ok: true });
    expect(html).not.toContain("Possible duplicate");
    expect(html).not.toContain("View created job");
  });
});