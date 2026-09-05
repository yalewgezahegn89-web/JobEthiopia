import { describe, it, expect, vi } from "vitest";
import {
  fetchJobs,
  fetchJobById,
  formatSalary,
  formatDate,
  toPublicJobSummary,
  toPublicJobDetail,
  PublicApiError,
  daysSince,
  freshnessLabel,
  closingState,
  buildShareLinks,
  isJobStale,
  DEFAULT_STALE_MAX_AGE_DAYS,
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

  it("throws in production when APP_BASE_URL is missing (no localhost fallback)", async () => {
    const previous = process.env.APP_BASE_URL;
    delete process.env.APP_BASE_URL;
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));

    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(fetchJobs({}, { fetcher })).rejects.toThrow(
        "APP_BASE_URL is required in production",
      );
    } finally {
      vi.unstubAllEnvs();
    }

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

  it("maps the verificationStatus field", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_JOB_ITEM }));

    const job = await fetchJobById(FULL_JOB_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(job).not.toBeNull();
    expect(job?.verificationStatus).toBe("VERIFIED");
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
    expect(detail.verificationStatus).toBeNull();
    expect(detail.lastVerifiedAt).toBeNull();
    expect(detail.firstSeenAt).toBeNull();
    expect(detail.createdAt).toBeNull();
  });

  it("toPublicJobSummary maps verificationStatus and raw deadline", () => {
    const summary = toPublicJobSummary({
      verificationStatus: "VERIFIED",
      deadline: "2026-02-15T00:00:00.000Z",
      postedAt: "2026-01-15T00:00:00.000Z",
    });

    expect(summary.verificationStatus).toBe("VERIFIED");
    expect(summary.deadline).toBe("2026-02-15T00:00:00.000Z");
    expect(summary.postedAt).toBe("2026-01-15T00:00:00.000Z");
  });

  it("toPublicJobSummary maps missing verificationStatus and deadline to null", () => {
    const summary = toPublicJobSummary({});

    expect(summary.verificationStatus).toBeNull();
    expect(summary.deadline).toBeNull();
    expect(summary.postedAt).toBeNull();
    expect(summary.status).toBeNull();
  });

  it("toPublicJobSummary maps non-string verificationStatus to null and status defensively", () => {
    const summary = toPublicJobSummary({ verificationStatus: 42, deadline: 123, status: "PUBLISHED" });

    expect(summary.verificationStatus).toBeNull();
    expect(summary.deadline).toBe("123");
    expect(summary.status).toBe("PUBLISHED");
  });

  it("toPublicJobDetail maps lastVerifiedAt, firstSeenAt, createdAt and status", () => {
    const detail = toPublicJobDetail({
      lastVerifiedAt: "2026-02-10T00:00:00.000Z",
      firstSeenAt: "2026-01-14T00:00:00.000Z",
      createdAt: "2026-01-14T00:00:00.000Z",
      status: "PUBLISHED",
    });

    expect(detail.lastVerifiedAt).toBe("2026-02-10T00:00:00.000Z");
    expect(detail.firstSeenAt).toBe("2026-01-14T00:00:00.000Z");
    expect(detail.createdAt).toBe("2026-01-14T00:00:00.000Z");
    expect(detail.status).toBe("PUBLISHED");
  });

  it("toPublicJobDetail maps verificationStatus", () => {
    const detail = toPublicJobDetail({ verificationStatus: "VERIFIED" });

    expect(detail.verificationStatus).toBe("VERIFIED");
  });

  it("toPublicJobDetail coerces string description", () => {
    const detail = toPublicJobDetail({ description: "Job description" });

    expect(detail.description).toBe("Job description");
  });
});

describe("daysSince", () => {
  it("returns null for null input", () => {
    expect(daysSince(null, new Date("2026-02-15T00:00:00.000Z"))).toBeNull();
  });

  it("returns null for an invalid date", () => {
    expect(daysSince("not-a-date", new Date("2026-02-15T00:00:00.000Z"))).toBeNull();
  });

  it("returns 0 for today", () => {
    expect(
      daysSince("2026-02-15T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe(0);
  });

  it("returns 1 for one day ago", () => {
    expect(
      daysSince("2026-02-14T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe(1);
  });

  it("returns the number of days for multiple days", () => {
    expect(
      daysSince("2026-02-10T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe(5);
  });

  it("returns 0 for a future date (never negative)", () => {
    expect(
      daysSince("2026-02-20T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe(0);
  });

  it("defaults now when not provided", () => {
    expect(typeof daysSince("2026-02-15T00:00:00.000Z")).toBe("number");
  });
});

describe("freshnessLabel", () => {
  it("returns null for null input", () => {
    expect(freshnessLabel(null, new Date("2026-02-15T00:00:00.000Z"))).toBeNull();
  });

  it("returns null for an invalid date", () => {
    expect(
      freshnessLabel("not-a-date", new Date("2026-02-15T00:00:00.000Z")),
    ).toBeNull();
  });

  it("returns Today for today", () => {
    expect(
      freshnessLabel("2026-02-15T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("Today");
  });

  it("returns 1 day ago for one day", () => {
    expect(
      freshnessLabel("2026-02-14T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("1 day ago");
  });

  it("returns n days ago for multiple days", () => {
    expect(
      freshnessLabel("2026-02-10T00:00:00.000Z", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("5 days ago");
  });
});

describe("closingState", () => {
  it("returns null for a null deadline when not expired", () => {
    expect(closingState(null, "PUBLISHED", new Date("2026-02-15T00:00:00.000Z"))).toBeNull();
  });

  it("returns null for an invalid deadline when not expired", () => {
    expect(
      closingState("not-a-date", "PUBLISHED", new Date("2026-02-15T00:00:00.000Z")),
    ).toBeNull();
  });

  it("returns EXPIRED when status is EXPIRED regardless of deadline", () => {
    expect(closingState("2026-02-20T00:00:00.000Z", "EXPIRED", new Date("2026-02-15T00:00:00.000Z"))).toBe("EXPIRED");
    expect(closingState(null, "EXPIRED", new Date("2026-02-15T00:00:00.000Z"))).toBe("EXPIRED");
  });

  it("returns EXPIRED for a past deadline", () => {
    expect(
      closingState("2026-02-10T00:00:00.000Z", "PUBLISHED", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("EXPIRED");
  });

  it("returns CLOSING for a deadline within 7 days", () => {
    expect(
      closingState("2026-02-20T00:00:00.000Z", "PUBLISHED", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("CLOSING");
  });

  it("returns CLOSING for a deadline exactly 7 days away", () => {
    expect(
      closingState("2026-02-22T00:00:00.000Z", "PUBLISHED", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("CLOSING");
  });

  it("returns OPEN for a deadline more than 7 days away", () => {
    expect(
      closingState("2026-03-01T00:00:00.000Z", "PUBLISHED", new Date("2026-02-15T00:00:00.000Z")),
    ).toBe("OPEN");
  });
});

describe("buildShareLinks", () => {
  it("builds a correctly encoded WhatsApp URL with title and url", () => {
    const links = buildShareLinks("Staff Nurse", "https://jobs.et/jobs/123");

    expect(links.whatsappUrl).toBe(
      "https://wa.me/?text=Staff+Nurse%0Ahttps%3A%2F%2Fjobs.et%2Fjobs%2F123",
    );
  });

  it("encodes a title with special characters using URLSearchParams rules", () => {
    const title = "Nurse & Engineer / (FT)";
    const url = "https://jobs.et/jobs/a";
    const links = buildShareLinks(title, url);

    const encodedText = new URLSearchParams({ text: `${title}\n${url}` }).toString();
    expect(links.whatsappUrl).toBe(`https://wa.me/?${encodedText}`);
    expect(links.whatsappUrl).toContain("https%3A%2F%2Fjobs.et%2Fjobs%2Fa");
  });

  it("exposes only title and url (no applicationUrl/internal fields)", () => {
    const links = buildShareLinks("Staff Nurse", "https://jobs.et/jobs/123");

    expect(links.whatsappUrl).not.toContain("applicationUrl");
    expect(links.whatsappUrl).not.toContain("lastVerifiedAt");
    expect(links.whatsappUrl).not.toContain("firstSeenAt");
  });
});

describe("isJobStale", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("returns true when lastVerifiedAt is null", () => {
    expect(isJobStale(null, 30, now)).toBe(true);
  });

  it("returns true when lastVerifiedAt is undefined", () => {
    expect(isJobStale(undefined, 30, now)).toBe(true);
  });

  it("returns true when lastVerifiedAt is an invalid date", () => {
    expect(isJobStale("not-a-date", 30, now)).toBe(true);
  });

  it("returns false when lastVerifiedAt is recent (1 day ago)", () => {
    expect(isJobStale("2026-05-31T12:00:00.000Z", 30, now)).toBe(false);
  });

  it("returns false when lastVerifiedAt is 29 days ago (below threshold)", () => {
    expect(isJobStale("2026-05-03T12:00:00.000Z", 30, now)).toBe(false);
  });

  it("returns true when lastVerifiedAt is exactly 30 days ago (at threshold)", () => {
    expect(isJobStale("2026-05-02T12:00:00.000Z", 30, now)).toBe(true);
  });

  it("returns true when lastVerifiedAt is 31 days ago (above threshold)", () => {
    expect(isJobStale("2026-05-01T12:00:00.000Z", 30, now)).toBe(true);
  });

  it("returns false when lastVerifiedAt is in the future", () => {
    expect(isJobStale("2026-06-02T12:00:00.000Z", 30, now)).toBe(false);
  });

  it("respects configurable maxAgeDays", () => {
    const lastVerified = "2026-05-23T12:00:00.000Z";
    expect(isJobStale(lastVerified, 7, now)).toBe(true);
    expect(isJobStale(lastVerified, 10, now)).toBe(false);
  });

  it("defaults to DEFAULT_STALE_MAX_AGE_DAYS when maxAgeDays is omitted", () => {
    expect(DEFAULT_STALE_MAX_AGE_DAYS).toBe(30);
    const reference = new Date("2026-06-01T12:00:00.000Z");
    const recent = "2026-05-30T12:00:00.000Z";
    const old = "2026-04-01T12:00:00.000Z";
    expect(isJobStale(recent, 30, reference)).toBe(false);
    expect(isJobStale(old, 30, reference)).toBe(true);
  });

  it("treats a job verified just now as not stale", () => {
    expect(isJobStale(now.toISOString(), 30, now)).toBe(false);
  });

  it("treats a job verified 1ms ago as not stale", () => {
    const oneMsAgo = new Date(now.getTime() - 1).toISOString();
    expect(isJobStale(oneMsAgo, 30, now)).toBe(false);
  });
});