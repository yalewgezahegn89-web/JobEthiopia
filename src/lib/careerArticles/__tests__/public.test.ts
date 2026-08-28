import { describe, it, expect, vi } from "vitest";
import {
  fetchCareerArticles,
  fetchCareerArticle,
  formatDate,
  toPublicArticleSummary,
  toPublicArticleDetail,
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

function calledInit(fetcher: ReturnType<typeof vi.fn>): RequestInit | undefined {
  return fetcher.mock.calls[0][1];
}

const FULL_ARTICLE = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  title: "How to Ace an Interview",
  slug: "how-to-ace-an-interview",
  excerpt: "Practical tips for interviews.",
  content: "Prepare answers.\nCommunicate clearly.\nFollow up after.",
  category: "Career Advice",
  status: "PUBLISHED",
  publishedAt: "2026-02-10T00:00:00.000Z",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

const MINIMAL_ARTICLE = {
  id: "123e4567-e89b-12d3-a456-426614174001",
  title: "Resume Basics",
  slug: "resume-basics",
  excerpt: null,
  category: null,
  status: "PUBLISHED",
  publishedAt: null,
};

describe("fetchCareerArticles URL construction", () => {
  it("builds the /api/career-articles URL with the base URL", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/career-articles`);
  });

  it("defaults status to PUBLISHED", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("status=PUBLISHED");
  });

  it("preserves an explicit status over the default", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({ status: "DRAFT" }, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("status=DRAFT");
  });

  it("sends page and limit for pagination", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({ page: 3, limit: 10 }, { baseUrl: BASE_URL, fetcher });

    const url = calledUrl(fetcher);
    expect(url).toContain("page=3");
    expect(url).toContain("limit=10");
  });

  it("sends category as a query parameter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles(
      { category: "Career Advice" },
      { baseUrl: BASE_URL, fetcher },
    );

    expect(calledUrl(fetcher)).toContain("category=Career+Advice");
  });

  it("keeps deterministic parameter ordering: page, limit, status, category", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles(
      { page: 2, limit: 5, status: "PUBLISHED", category: "Resume" },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = new URL(calledUrl(fetcher));
    expect(url.search).toBe("?page=2&limit=5&status=PUBLISHED&category=Resume");
  });

  it("requests with no-store cache", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });

    expect(calledInit(fetcher)).toEqual({ cache: "no-store" });
  });

  it("uses the provided baseUrl", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({}, { baseUrl: "http://localhost:3456", fetcher });

    expect(calledUrl(fetcher)).toBe(
      "http://localhost:3456/api/career-articles?page=1&limit=20&status=PUBLISHED",
    );
  });

  it("does not send a keyword search parameter (backend has no q support)", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles(
      { category: "Career Advice" },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = new URL(calledUrl(fetcher));
    expect(url.searchParams.has("q")).toBe(false);
  });

  it("uses APP_BASE_URL when baseUrl is not provided", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://careers.et";
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchCareerArticles({}, { fetcher });

    expect(calledUrl(fetcher)).toContain(
      "https://careers.et/api/career-articles",
    );

    if (previous === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  });
});

describe("fetchCareerArticles response handling", () => {
  it("maps successful API items to article summaries", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_ARTICLE],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("How to Ace an Interview");
  });

  it("maps summary fields without requiring content", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ items: [FULL_ARTICLE], pagination: {} }),
    );

    const result = await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });
    const item = result.items[0];

    expect(item.id).toBe(FULL_ARTICLE.id);
    expect(item.title).toBe("How to Ace an Interview");
    expect(item.slug).toBe("how-to-ace-an-interview");
    expect(item.category).toBe("Career Advice");
    expect(item.excerpt).toBe("Practical tips for interviews.");
    expect(item.publishedAt).toBe("Feb 10, 2026");
  });

  it("handles null excerpt and category safely", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ items: [MINIMAL_ARTICLE], pagination: {} }),
    );

    const result = await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });
    const item = result.items[0];

    expect(item.excerpt).toBeNull();
    expect(item.category).toBeNull();
    expect(item.publishedAt).toBeNull();
  });

  it("preserves pagination metadata", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_ARTICLE],
        pagination: { page: 2, limit: 5, total: 25, totalPages: 5 },
      }),
    );

    const result = await fetchCareerArticles(
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

    const result = await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher });

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
      fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });

  it("does not leak the upstream error message", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "SECRET_INGESTION_API_KEY=xyz" }, 500),
    );

    const error = await fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(PublicApiError);
    expect((error as Error).message).not.toContain("SECRET_INGESTION_API_KEY");
  });

  it("throws a generic PublicApiError when the response body is invalid JSON", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    await expect(
      fetchCareerArticles({}, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });
});

describe("fetchCareerArticle", () => {
  it("builds the detail URL from the article id", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_ARTICLE }));
    await fetchCareerArticle(FULL_ARTICLE.id, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toBe(
      `${BASE_URL}/api/career-articles/${FULL_ARTICLE.id}`,
    );
  });

  it("maps the detail item", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_ARTICLE }));

    const article = await fetchCareerArticle(FULL_ARTICLE.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(article).not.toBeNull();
    expect(article?.title).toBe("How to Ace an Interview");
    expect(article?.category).toBe("Career Advice");
    expect(article?.excerpt).toBe("Practical tips for interviews.");
    expect(article?.status).toBe("PUBLISHED");
    expect(article?.publishedAt).toBe("Feb 10, 2026");
  });

  it("preserves the full content", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_ARTICLE }));

    const article = await fetchCareerArticle(FULL_ARTICLE.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(article?.content).toBe(
      "Prepare answers.\nCommunicate clearly.\nFollow up after.",
    );
  });

  it("returns null content when the payload item lacks content", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: MINIMAL_ARTICLE }));

    const article = await fetchCareerArticle(MINIMAL_ARTICLE.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(article).not.toBeNull();
    expect(article?.content).toBeNull();
    expect(article?.category).toBeNull();
    expect(article?.publishedAt).toBeNull();
  });

  it("returns null when the article is not found (404)", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "Career article not found" }, 404),
    );

    const article = await fetchCareerArticle("missing", {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(article).toBeNull();
  });

  it("returns null when the payload has no item", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const article = await fetchCareerArticle(FULL_ARTICLE.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(article).toBeNull();
  });

  it("throws a generic PublicApiError on non-OK non-404 responses", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    await expect(
      fetchCareerArticle(FULL_ARTICLE.id, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });

  it("does not leak the upstream error message on detail errors", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "SECRET_INGESTION_API_KEY=xyz" }, 500),
    );

    const error = await fetchCareerArticle(FULL_ARTICLE.id, {
      baseUrl: BASE_URL,
      fetcher,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(PublicApiError);
    expect((error as Error).message).not.toContain("SECRET_INGESTION_API_KEY");
  });

  it("throws a generic PublicApiError when the detail body is invalid JSON", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    await expect(
      fetchCareerArticle(FULL_ARTICLE.id, { baseUrl: BASE_URL, fetcher }),
    ).rejects.toBeInstanceOf(PublicApiError);
  });
});

describe("formatDate", () => {
  it("formats an ISO date string", () => {
    expect(formatDate("2026-02-10T00:00:00.000Z")).toBe("Feb 10, 2026");
  });

  it("formats a Date object", () => {
    expect(formatDate(new Date("2026-02-10T00:00:00.000Z"))).toBe(
      "Feb 10, 2026",
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
  it("toPublicArticleSummary handles missing fields safely", () => {
    const summary = toPublicArticleSummary({});

    expect(summary.id).toBe("");
    expect(summary.title).toBe("");
    expect(summary.category).toBeNull();
    expect(summary.excerpt).toBeNull();
    expect(summary.publishedAt).toBeNull();
    expect(summary).not.toHaveProperty("content");
  });

  it("toPublicArticleDetail handles missing fields safely", () => {
    const detail = toPublicArticleDetail({});

    expect(detail.id).toBe("");
    expect(detail.content).toBeNull();
    expect(detail.status).toBeNull();
    expect(detail.excerpt).toBeNull();
  });

  it("toPublicArticleDetail coerces string content", () => {
    const detail = toPublicArticleDetail({ content: "Article body" });

    expect(detail.content).toBe("Article body");
  });
});