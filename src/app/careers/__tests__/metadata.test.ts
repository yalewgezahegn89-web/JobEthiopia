import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFetchCareerArticle: vi.fn(),
  mockFetchCareerArticles: vi.fn(),
}));

vi.mock("@/lib/careerArticles/public", () => ({
  fetchCareerArticle: (...args: unknown[]) =>
    mocks.mockFetchCareerArticle(...args),
  fetchCareerArticles: (...args: unknown[]) =>
    mocks.mockFetchCareerArticles(...args),
}));

vi.mock("@/lib/careerArticles/related", () => ({
  selectRelatedArticles: () => [],
}));

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://jobethiopia.com",
}));

vi.mock("@/components/public/breadcrumb", () => ({
  Breadcrumb: () => null,
}));

vi.mock("@/components/public/icons", () => ({
  BookIcon: () => null,
  CalendarIcon: () => null,
  ArrowRightIcon: () => null,
}));

import { generateMetadata } from "../[id]/page";

const PUBLISHED_ARTICLE = {
  id: "article-1",
  title: "How to Write a Strong CV",
  slug: "how-to-write-a-strong-cv",
  category: "Resume",
  excerpt: "Practical tips for Ethiopian job seekers.",
  content: "Some content.",
  status: "PUBLISHED",
  publishedAt: "2026-02-10T00:00:00.000Z",
};

const DRAFT_ARTICLE = {
  ...PUBLISHED_ARTICLE,
  status: "DRAFT",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("careers/[id] generateMetadata", () => {
  it("builds title, description, canonical, and OG for a published article", async () => {
    mocks.mockFetchCareerArticle.mockResolvedValue(PUBLISHED_ARTICLE);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: "article-1" }),
    });

    expect(meta.title).toBe("How to Write a Strong CV");
    expect(meta.description).toContain("Practical tips");
    expect(meta.alternates?.canonical).toBe(
      "https://jobethiopia.com/careers/article-1",
    );
    expect(meta.openGraph?.title).toContain("How to Write a Strong CV");
    expect(meta.openGraph?.url).toBe(
      "https://jobethiopia.com/careers/article-1",
    );
    expect(meta.openGraph?.siteName).toBe("JobEthiopia");
    expect(meta.robots).toBeUndefined();
  });

  it("returns fallback metadata when the article is not found", async () => {
    mocks.mockFetchCareerArticle.mockResolvedValue(null);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: "missing" }),
    });

    expect(meta.title).toBe("Career Resource | JobEthiopia");
  });

  it("sets robots noindex for an unpublished article", async () => {
    mocks.mockFetchCareerArticle.mockResolvedValue(DRAFT_ARTICLE);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: "article-1" }),
    });

    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph).toBeUndefined();
  });
});
