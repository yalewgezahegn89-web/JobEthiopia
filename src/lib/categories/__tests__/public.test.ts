import { describe, it, expect, vi } from "vitest";
import {
  fetchCategories,
  fetchCategoryById,
  toPublicCategorySummary,
  toPublicCategoryDetail,
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

const FULL_CATEGORY_ITEM = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Healthcare",
  slug: "healthcare",
  description: "Medical and health-related roles.",
  parentId: null,
  isActive: true,
  sortOrder: 1,
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

describe("fetchCategories URL construction", () => {
  it("builds list URL against the categories API", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/categories`);
  });

  it("defaults page to 1", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("page=1");
  });

  it("defaults limit to 20", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("limit=20");
  });

  it("defaults isActive to true", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("isActive=true");
  });

  it("sends explicit isActive=false", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories(
      { isActive: false },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("isActive=false");
  });

  it("sends parentId filter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories(
      { parentId: "110e8400-e29b-41d4-a716-446655440012" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain(
      "parentId=110e8400-e29b-41d4-a716-446655440012",
    );
  });

  it("orders page, limit, isActive before parentId", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories(
      { parentId: "110e8400-e29b-41d4-a716-446655440012" },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = calledUrl(fetcher);
    expect(url.indexOf("page=1")).toBeLessThan(url.indexOf("parentId="));
    expect(url.indexOf("limit=20")).toBeLessThan(url.indexOf("parentId="));
    expect(url.indexOf("isActive=true")).toBeLessThan(
      url.indexOf("parentId="),
    );
  });

  it("uses explicit baseUrl", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/categories`);
  });

  it("uses APP_BASE_URL when baseUrl is not provided", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://jobs.et";
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCategories({}, { fetcher });

    expect(calledUrl(fetcher)).toContain("https://jobs.et/api/categories");

    if (previous === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  });
});

describe("fetchCategories response handling", () => {
  it("maps successful API items to category summaries", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_CATEGORY_ITEM],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: FULL_CATEGORY_ITEM.id,
      name: "Healthcare",
      slug: "healthcare",
      description: "Medical and health-related roles.",
      parentId: null,
      isActive: true,
      sortOrder: 1,
    });
  });

  it("maps pagination", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [],
        pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
      }),
    );

    const result = await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

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
        items: [{ ...FULL_CATEGORY_ITEM, id: "x", description: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items[0].description).toBeNull();
  });

  it("handles nullable parentId", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [{ ...FULL_CATEGORY_ITEM, id: "x", parentId: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchCategories({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items[0].parentId).toBeNull();
  });

  it("does not fabricate job counts", () => {
    const summary = toPublicCategorySummary(FULL_CATEGORY_ITEM);

    expect("jobCount" in summary).toBe(false);
    expect("publishedJobCount" in summary).toBe(false);
    expect("professionCount" in summary).toBe(false);
    expect("parentName" in summary).toBe(false);
    expect("locationName" in summary).toBe(false);
  });

  it("throws generic PublicApiError on non-OK list response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchCategories({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("throws generic PublicApiError on invalid JSON list response", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    const error = await fetchCategories({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("does not leak upstream error text for list responses", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "internal database failure: psql ..." }, 500),
    );

    const error = await fetchCategories({}, { baseUrl: BASE_URL, fetcher })
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

describe("toPublicCategoryDetail", () => {
  it("maps detail fields including timestamps", () => {
    const detail = toPublicCategoryDetail(FULL_CATEGORY_ITEM);

    expect(detail).toMatchObject({
      id: FULL_CATEGORY_ITEM.id,
      name: "Healthcare",
      description: "Medical and health-related roles.",
      parentId: null,
      isActive: true,
      sortOrder: 1,
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });
});

describe("fetchCategoryById", () => {
  it("returns null on 404", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "Category not found" }, 404),
    );

    const result = await fetchCategoryById("missing", {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("returns null when item is missing", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const result = await fetchCategoryById(FULL_CATEGORY_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("throws generic PublicApiError on non-OK detail response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchCategoryById(FULL_CATEGORY_ITEM.id, {
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

    const error = await fetchCategoryById(FULL_CATEGORY_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("maps a successful detail item", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_CATEGORY_ITEM }));

    const result = await fetchCategoryById(FULL_CATEGORY_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result?.name).toBe("Healthcare");
    expect(result?.description).toBe("Medical and health-related roles.");
    expect(result?.isActive).toBe(true);
  });
});
