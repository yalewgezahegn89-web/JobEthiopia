import { describe, it, expect, vi } from "vitest";
import {
  fetchJobs,
  fetchJobById,
  formatSalary,
  formatDate,
  toPublicJobSummary,
  toPublicJobDetail,
  PublicApiError,
} from "../public";

const BASE_URL = "https://example.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFetcher(response: Response | (() => Response)) {
  return vi.fn(async () =>
    typeof response === "function" ? response() : response,
  );
}

function calledUrl(fetcher: ReturnType<typeof vi.fn>): string {
  const input = fetcher.mock.calls[0][0];
  return String(input);
}

const FULL_JOB_ITEM = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Staff Nurse",
  slug: "staff-nurse-black-lion",
  organizationId: "123e4567-e89b-12d3-a456-426614174000",
  categoryId: "110e8400-e29b-41d4-a716-446655440010",
  professionId: "110e8400-e29b-41d4-a716-446655440011",
  locationId: "110e8400-e29b-41d4-a716-446655440012",
  description: "Nursing role at hospital",
  responsibilities: "Patient care",
  requirements: "Valid nursing license",
  educationRequirements: "BSc in Nursing",
  benefits: "Health insurance",
  experienceMin: 1,
  experienceMax: 3,
  employmentType: "FULL_TIME",
  salaryMin: "50000",
  salaryMax: "100000",
  salaryCurrency: "ETB",
  salaryPeriod: "MONTHLY",
  postedAt: "2026-01-15T00:00:00.000Z",
  deadline: "2026-02-15T00:00:00.000Z",
  applicationUrl: "https://example.com/apply",
  status: "PUBLISHED",
  verificationStatus: "VERIFIED",
  organization: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Black Lion Hospital",
    slug: "black-lion-hospital",
  },
  category: {
    id: "110e8400-e29b-41d4-a716-446655440010",
    name: "Healthcare",
    slug: "healthcare",
  },
  profession: {
    id: "110e8400-e29b-41d4-a716-446655440011",
    name: "Nursing",
    slug: "nursing",
  },
  location: {
    id: "110e8400-e29b-41d4-a716-446655440012",
    name: "Addis Ababa",
    slug: "addis-ababa",
  },
};

const MINIMAL_JOB_ITEM = {
  id: "660e8400-e29b-41d4-a716-446655440001",
  title: "Software Engineer",
  slug: "software-engineer",
  organizationId: null,
  categoryId: null,
  professionId: null,
  locationId: null,
  description: "A software engineering role",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
  postedAt: null,
  deadline: null,
  employmentType: null,
  applicationUrl: null,
  organization: null,
  category: null,
  profession: null,
  location: null,
};

describe("fetchJobs URL construction", () => {
  it("builds the /api/jobs URL with the base URL", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/jobs`);
  });

  it("defaults status to PUBLISHED", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("status=PUBLISHED");
  });

  it("preserves an explicit status over the default", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs({ status: "DRAFT" }, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("status=DRAFT");
  });

  it("sends q as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs({ q: "nurse" }, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("q=nurse");
  });

  it("sends categoryId as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs(
      { categoryId: "110e8400-e29b-41d4-a716-446655440010" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "categoryId=110e8400-e29b-41d4-a716-446655440010",
    );
  });

  it("sends professionId as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs(
      { professionId: "110e8400-e29b-41d4-a716-446655440011" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "professionId=110e8400-e29b-41d4-a716-446655440011",
    );
  });

  it("sends locationId as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs(
      { locationId: "110e8400-e29b-41d4-a716-446655440012" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "locationId=110e8400-e29b-41d4-a716-446655440012",
    );
  });

  it("sends organizationId as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs(
      { organizationId: "123e4567-e89b-12d3-a456-426614174000" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "organizationId=123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("sends employmentType as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs(
      { employmentType: "FULL_TIME" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("employmentType=FULL_TIME");
  });

  it("sends page and limit for pagination", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs({ page: 2, limit: 10 }, { baseUrl: BASE_URL, fetcher });

    const url = calledUrl(fetcher);
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
  });

  it("combines all provided query parameters", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs(
      {
        q: "nurse",
        categoryId: "110e8400-e29b-41d4-a716-446655440010",
        professionId: "110e8400-e29b-41d4-a716-446655440011",
        locationId: "110e8400-e29b-41d4-a716-446655440012",
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        employmentType: "FULL_TIME",
        status: "PUBLISHED",
        page: 3,
        limit: 10,
      },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = calledUrl(fetcher);
    expect(url).toContain("q=nurse");
    expect(url).toContain("categoryId=110e8400-e29b-41d4-a716-446655440010");
    expect(url).toContain("professionId=110e8400-e29b-41d4-a716-446655440011");
    expect(url).toContain("locationId=110e8400-e29b-41d4-a716-446655440012");
    expect(url).toContain(
      "organizationId=123e4567-e89b-12d3-a456-426614174000",
    );
    expect(url).toContain("employmentType=FULL_TIME");
    expect(url).toContain("status=PUBLISHED");
    expect(url).toContain("page=3");
    expect(url).toContain("limit=10");
  });

  it("uses APP_BASE_URL when baseUrl is not provided", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://jobs.et";
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchJobs({}, { fetcher });

    expect(calledUrl(fetcher)).toContain("https://jobs.et/api/jobs");

    if (previous === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  });
});

describe("fetchJobs response handling", () => {
  it("maps successful API items to job summaries", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_JOB_ITEM],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchJobs({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Staff Nurse");
  });

  it("maps joined organization/category/profession/location names", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_JOB_ITEM],
        pagination: {},
      }),
    );

    const result = await fetchJobs({}, { baseUrl: BASE_URL, fetcher });
    const item = result.items[0];

    expect(item.organizationName).toBe("Black Lion Hospital");
    expect(item.categoryName).toBe("Healthcare");
    expect(item.professionName).toBe("Nursing");
    expect(item.locationName).toBe("Addis Ababa");
    expect(item.organizationId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(item.categoryId).toBe("110e8400-e29b-41d4-a716-446655440010");
    expect(item.professionId).toBe("110e8400-e29b-41d4-a716-446655440011");
    expect(item.locationId).toBe("110e8400-e29b-41d4-a716-446655440012");
  });

  it("handles null entity relationships", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [MINIMAL_JOB_ITEM],
        pagination: {},
      }),
    );

    const result = await fetchJobs({}, { baseUrl: BASE_URL, fetcher });
    const item = result.items[0];

    expect(item.organizationName).toBeNull();
    expect(item.categoryName).toBeNull();
    expect(item.professionName).toBeNull();
    expect(item.locationName).toBeNull();
    expect(item.organizationId).toBeNull();
    expect(item.categoryId).toBeNull();
    expect(item.professionId).toBeNull();
    expect(item.locationId).toBeNull();
    expect(item.salaryText).toBeNull();
    expect(item.deadlineText).toBeNull();
  });

  it("preserves pagination metadata", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_JOB_ITEM],
        pagination: { page: 2, limit: 5, total: 25, totalPages: 5 },
      }),
    );

    const result = await fetchJobs(
      { page: 2, limit: 5 },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 25,
      totalPages: 5,
    });
  });

  it("defaults pagination when missing", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const result = await fetchJobs({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("throws a generic PublicApiError on non-OK responses", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    await expect(
      fetchJobs({}, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });

  it("does not leak the upstream error message", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "SECRET_DB_PASSWORD=xyz" }, 500),
    );

    const error = await fetchJobs({}, { baseUrl: BASE_URL, fetcher }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(PublicApiError);
    expect((error as Error).message).not.toContain("SECRET_DB_PASSWORD");
  });

  it("throws a generic PublicApiError when the response body is invalid JSON", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    await expect(
      fetchJobs({}, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });
});

describe("fetchJobById", () => {
  it("builds the detail URL from the job id", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_JOB_ITEM }));
    await fetchJobById(FULL_JOB_ITEM.id, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toBe(
      `${BASE_URL}/api/jobs/${FULL_JOB_ITEM.id}`,
    );
  });

  it("maps the detail item including joined entities", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_JOB_ITEM }));

    const job = await fetchJobById(FULL_JOB_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(job).not.toBeNull();
    expect(job?.title).toBe("Staff Nurse");
    expect(job?.organizationName).toBe("Black Lion Hospital");
    expect(job?.categoryName).toBe("Healthcare");
    expect(job?.professionName).toBe("Nursing");
    expect(job?.locationName).toBe("Addis Ababa");
    expect(job?.description).toBe("Nursing role at hospital");
    expect(job?.requirements).toBe("Valid nursing license");
    expect(job?.benefits).toBe("Health insurance");
    expect(job?.applicationUrl).toBe("https://example.com/apply");
  });

  it("returns null when the job is not found (404)", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "Job not found" }, 404));

    const job = await fetchJobById("missing", { baseUrl: BASE_URL, fetcher });

    expect(job).toBeNull();
  });

  it("returns null when the payload has no item", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const job = await fetchJobById(FULL_JOB_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(job).toBeNull();
  });

  it("throws a generic PublicApiError on non-OK non-404 responses", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    await expect(
      fetchJobById(FULL_JOB_ITEM.id, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });
});

describe("formatSalary", () => {
  it("formats a full salary range with currency and period", () => {
    expect(formatSalary("50000", "100000", "ETB", "MONTHLY")).toBe(
      "50,000 - 100,000 ETB / monthly",
    );
  });

  it("formats a single salary bound with currency", () => {
    expect(formatSalary("50000", null, "ETB", null)).toBe("50,000 ETB");
  });

  it("formats a single max bound", () => {
    expect(formatSalary(null, "100000", "ETB", "YEARLY")).toBe(
      "100,000 ETB / yearly",
    );
  });

  it("accepts numeric salary values", () => {
    expect(formatSalary(50000, 100000, "ETB", "MONTHLY")).toBe(
      "50,000 - 100,000 ETB / monthly",
    );
  });

  it("returns null when no salary is provided", () => {
    expect(formatSalary(null, null, null, null)).toBeNull();
  });

  it("returns null when salary is undefined", () => {
    expect(formatSalary(undefined, undefined, undefined, undefined)).toBeNull();
  });

  it("formats a zero salary", () => {
    expect(formatSalary(0, null, "ETB", null)).toBe("0 ETB");
  });
});

describe("formatDate", () => {
  it("formats an ISO date string", () => {
    expect(formatDate("2026-02-15T00:00:00.000Z")).toBe("Feb 15, 2026");
  });

  it("formats a Date object", () => {
    expect(formatDate(new Date("2026-02-15T00:00:00.000Z"))).toBe(
      "Feb 15, 2026",
    );
  });

  it("returns null for null input", () => {
    expect(formatDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatDate(undefined)).toBeNull();
  });

  it("returns null for an invalid date", () => {
    expect(formatDate("not-a-date")).toBeNull();
  });
});

describe("view model mappers", () => {
  it("toPublicJobSummary handles missing fields safely", () => {
    const summary = toPublicJobSummary({});

    expect(summary.id).toBe("");
    expect(summary.title).toBe("");
    expect(summary.organizationName).toBeNull();
    expect(summary.salaryText).toBeNull();
    expect(summary.deadlineText).toBeNull();
  });

  it("toPublicJobDetail handles missing fields safely", () => {
    const detail = toPublicJobDetail({});

    expect(detail.id).toBe("");
    expect(detail.description).toBeNull();
    expect(detail.applicationUrl).toBeNull();
    expect(detail.salaryText).toBeNull();
    expect(detail.experienceMin).toBeNull();
  });

  it("toPublicJobDetail coerces string description", () => {
    const detail = toPublicJobDetail({ description: "Job description" });

    expect(detail.description).toBe("Job description");
  });
});