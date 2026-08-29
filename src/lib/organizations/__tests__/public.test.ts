import { describe, it, expect, vi } from "vitest";
import {
  fetchOrganizations,
  fetchOrganizationById,
  toPublicOrganizationSummary,
  toPublicOrganizationDetail,
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

const FULL_ORG_ITEM = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Black Lion Hospital",
  slug: "black-lion-hospital",
  description: "Leading national referral hospital in Addis Ababa.",
  industry: "Healthcare",
  websiteUrl: "https://blacklion.et",
  logoUrl: "https://cdn.example.com/blacklion.png",
  locationId: "110e8400-e29b-41d4-a716-446655440012",
  isVerified: true,
  status: "ACTIVE",
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

describe("fetchOrganizations URL construction", () => {
  it("builds list URL against the organizations API", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/organizations`);
  });

  it("defaults page to 1", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("page=1");
  });

  it("defaults limit to 20", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("limit=20");
  });

  it("defaults status to ACTIVE", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("status=ACTIVE");
  });

  it("sends explicit status", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations(
      { status: "INACTIVE" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("status=INACTIVE");
  });

  it("sends locationId query", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations(
      { locationId: "110e8400-e29b-41d4-a716-446655440012" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "locationId=110e8400-e29b-41d4-a716-446655440012",
    );
  });

  it("sends isVerified=true query", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations(
      { isVerified: true },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("isVerified=true");
  });

  it("sends isVerified=false query", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations(
      { isVerified: false },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("isVerified=false");
  });

  it("orders parameters page, limit, status before filters", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations(
      {
        locationId: "110e8400-e29b-41d4-a716-446655440012",
        isVerified: true,
      },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = calledUrl(fetcher);
    expect(url.indexOf("page=1")).toBeLessThan(
      url.indexOf("locationId="),
    );
    expect(url.indexOf("limit=20")).toBeLessThan(
      url.indexOf("isVerified="),
    );
    expect(url.indexOf("status=ACTIVE")).toBeLessThan(
      url.indexOf("locationId="),
    );
  });

  it("uses explicit baseUrl", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/organizations`);
  });

  it("uses APP_BASE_URL when baseUrl is not provided", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://jobs.et";
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchOrganizations({}, { fetcher });

    expect(calledUrl(fetcher)).toContain("https://jobs.et/api/organizations");

    if (previous === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  });
});

describe("fetchOrganizations response handling", () => {
  it("maps successful API items to organization summaries", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_ORG_ITEM],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: FULL_ORG_ITEM.id,
      name: "Black Lion Hospital",
      slug: "black-lion-hospital",
      industry: "Healthcare",
      websiteUrl: "https://blacklion.et",
      logoUrl: "https://cdn.example.com/blacklion.png",
      isVerified: true,
      status: "ACTIVE",
    });
  });

  it("maps pagination", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [],
        pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
      }),
    );

    const result = await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("handles nullable fields defensively", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "No Logo Org",
            slug: "no-logo-org",
            description: null,
            industry: null,
            websiteUrl: null,
            logoUrl: null,
            locationId: null,
            isVerified: false,
            status: "ACTIVE",
            createdAt: null,
            updatedAt: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items[0]).toMatchObject({
      industry: null,
      websiteUrl: null,
      logoUrl: null,
      isVerified: false,
    });
  });

  it("throws generic PublicApiError on non-OK list response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("throws generic PublicApiError on invalid JSON list response", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    const error = await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("does not leak upstream error text for list responses", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "internal database failure: psql ..." }, 500),
    );

    const error = await fetchOrganizations({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
    if (error instanceof Error) {
      expect(error.message).not.toContain("database");
      expect(error.message).not.toContain("psql");
      expect(error.message).not.toContain("internal database failure");
    }
  });
});

describe("toPublicOrganizationDetail", () => {
  it("maps detail fields including description and timestamps", () => {
    const detail = toPublicOrganizationDetail(FULL_ORG_ITEM);

    expect(detail).toMatchObject({
      id: FULL_ORG_ITEM.id,
      name: "Black Lion Hospital",
      description: "Leading national referral hospital in Addis Ababa.",
      industry: "Healthcare",
      websiteUrl: "https://blacklion.et",
      logoUrl: "https://cdn.example.com/blacklion.png",
      locationId: "110e8400-e29b-41d4-a716-446655440012",
      isVerified: true,
      status: "ACTIVE",
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("does not fabricate locationName or activeJobCount", () => {
    const detail = toPublicOrganizationDetail(FULL_ORG_ITEM);
    const summary = toPublicOrganizationSummary(FULL_ORG_ITEM);

    expect("locationName" in detail).toBe(false);
    expect("activeJobCount" in detail).toBe(false);
    expect("locationName" in summary).toBe(false);
    expect("activeJobCount" in summary).toBe(false);
  });
});

describe("fetchOrganizationById", () => {
  it("returns null on 404", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "Organization not found" }, 404));

    const result = await fetchOrganizationById("missing", {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("returns null when item is missing", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const result = await fetchOrganizationById(FULL_ORG_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("throws generic PublicApiError on non-OK detail response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchOrganizationById(FULL_ORG_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("throws generic PublicApiError on invalid JSON detail response", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    const error = await fetchOrganizationById(FULL_ORG_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("maps a successful detail item", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_ORG_ITEM }));

    const result = await fetchOrganizationById(FULL_ORG_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result?.name).toBe("Black Lion Hospital");
    expect(result?.description).toBe(
      "Leading national referral hospital in Addis Ababa.",
    );
    expect(result?.isVerified).toBe(true);
  });
});
