import { describe, it, expect, vi } from "vitest";
import {
  fetchProfessions,
  fetchProfessionById,
  toPublicProfessionSummary,
  toPublicProfessionDetail,
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

const FULL_PROFESSION_ITEM = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Nursing",
  slug: "nursing",
  description: "Registered and practical nursing roles.",
  categoryId: "110e8400-e29b-41d4-a716-446655440010",
  isActive: true,
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

describe("fetchProfessions URL construction", () => {
  it("defaults page to 1", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("page=1");
  });

  it("defaults limit to 20", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("limit=20");
  });

  it("defaults isActive to true", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("isActive=true");
  });

  it("sends explicit isActive=false", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions(
      { isActive: false },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("isActive=false");
  });

  it("sends categoryId filter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions(
      { categoryId: "110e8400-e29b-41d4-a716-446655440010" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "categoryId=110e8400-e29b-41d4-a716-446655440010",
    );
  });

  it("orders page, limit, isActive before categoryId", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions(
      { categoryId: "110e8400-e29b-41d4-a716-446655440010" },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = calledUrl(fetcher);
    expect(url.indexOf("page=1")).toBeLessThan(url.indexOf("categoryId="));
    expect(url.indexOf("limit=20")).toBeLessThan(url.indexOf("categoryId="));
    expect(url.indexOf("isActive=true")).toBeLessThan(
      url.indexOf("categoryId="),
    );
  });

  it("builds URL against the professions API", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/professions`);
  });

  it("uses exact parameter order", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    const url = calledUrl(fetcher);
    expect(url.indexOf("page=")).toBeLessThan(url.indexOf("limit="));
    expect(url.indexOf("limit=")).toBeLessThan(url.indexOf("isActive="));
  });
});

describe("fetchProfessions base URL handling", () => {
  it("uses explicit baseUrl", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/professions`);
  });

  it("uses APP_BASE_URL when baseUrl is not provided", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://jobs.et";
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchProfessions({}, { fetcher });

    expect(calledUrl(fetcher)).toContain("https://jobs.et/api/professions");

    if (previous === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  });
});

describe("fetchProfessions response handling", () => {
  it("maps successful API items to profession summaries", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_PROFESSION_ITEM],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: FULL_PROFESSION_ITEM.id,
      name: "Nursing",
      slug: "nursing",
      description: "Registered and practical nursing roles.",
      categoryId: "110e8400-e29b-41d4-a716-446655440010",
      isActive: true,
    });
  });

  it("maps pagination", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [],
        pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
      }),
    );

    const result = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("handles nullable description", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [{ ...FULL_PROFESSION_ITEM, id: "x", description: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items[0].description).toBeNull();
  });

  it("handles nullable categoryId", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [{ ...FULL_PROFESSION_ITEM, id: "x", categoryId: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items[0].categoryId).toBeNull();
  });

  it("preserves nullable fields as null", async () => {
    const item = toPublicProfessionSummary({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "No Details",
      slug: "no-details",
      description: null,
      categoryId: null,
      isActive: false,
    });

    expect(item.description).toBeNull();
    expect(item.categoryId).toBeNull();
    expect(item.isActive).toBe(false);
  });

  it("does not fabricate categoryName or job counts", () => {
    const summary = toPublicProfessionSummary(FULL_PROFESSION_ITEM);

    expect("categoryName" in summary).toBe(false);
    expect("jobCount" in summary).toBe(false);
    expect("publishedJobCount" in summary).toBe(false);
  });

  it("throws generic PublicApiError on non-OK list response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("throws generic PublicApiError on invalid JSON list response", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    const error = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("does not leak upstream error text for list responses", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "internal database failure: psql ..." }, 500),
    );

    const error = await fetchProfessions({}, { baseUrl: BASE_URL, fetcher })
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

describe("toPublicProfessionDetail", () => {
  it("maps all detail fields including timestamps", () => {
    const detail = toPublicProfessionDetail(FULL_PROFESSION_ITEM);

    expect(detail).toMatchObject({
      id: FULL_PROFESSION_ITEM.id,
      name: "Nursing",
      description: "Registered and practical nursing roles.",
      categoryId: "110e8400-e29b-41d4-a716-446655440010",
      isActive: true,
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("maps the set of expected fields", () => {
    const detail = toPublicProfessionDetail(FULL_PROFESSION_ITEM);
    const keys = Object.keys(detail).sort();

    expect(keys).toEqual(
      [
        "id",
        "name",
        "slug",
        "description",
        "categoryId",
        "isActive",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });
});

describe("fetchProfessionById", () => {
  it("returns null on 404", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "Profession not found" }, 404),
    );

    const result = await fetchProfessionById("missing", {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("returns null when item is missing", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const result = await fetchProfessionById(FULL_PROFESSION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("throws generic PublicApiError on non-OK detail response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchProfessionById(FULL_PROFESSION_ITEM.id, {
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

    const error = await fetchProfessionById(FULL_PROFESSION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("maps a successful detail item", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_PROFESSION_ITEM }));

    const result = await fetchProfessionById(FULL_PROFESSION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result?.name).toBe("Nursing");
    expect(result?.description).toBe("Registered and practical nursing roles.");
    expect(result?.categoryId).toBe(
      "110e8400-e29b-41d4-a716-446655440010",
    );
    expect(result?.isActive).toBe(true);
  });
});
