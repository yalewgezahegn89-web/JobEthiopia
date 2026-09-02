import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchCareerArticle: vi.fn(),
  mockFetchCareerArticles: vi.fn(),
  mockSelectRelatedArticles: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement(
      Fragment,
      null,
      createElement("a", { href, "data-testid": href }, children),
    ),
}));

vi.mock("@/lib/careerArticles/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/careerArticles/public")>();
  return {
    ...actual,
    fetchCareerArticle: (...a: unknown[]) => mocks.mockFetchCareerArticle(...a),
    fetchCareerArticles: (...a: unknown[]) => mocks.mockFetchCareerArticles(...a),
  };
});

vi.mock("@/lib/careerArticles/related", () => ({
  selectRelatedArticles: (...a: unknown[]) => mocks.mockSelectRelatedArticles(...a),
}));

import CareerArticlePage from "@/app/careers/[id]/page";

const ARTICLE_ID = "art-1";

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    title: "How to Write a Strong CV",
    slug: "how-to-write-a-strong-cv",
    category: "Resume tips",
    excerpt: "Practical steps to build a standout CV.",
    content:
      "Start with a clear summary.\nThen list your experience.\nEnd with references.",
    publishedAt: "2026-01-10",
    status: "PUBLISHED",
    ...overrides,
  };
}

function makeRelated(overrides: Record<string, unknown> = {}) {
  return {
    id: "art-2",
    title: "Interview Preparation",
    slug: "interview-preparation",
    category: "Resume tips",
    excerpt: null,
    publishedAt: "2026-02-01",
    ...overrides,
  };
}

async function renderPage(): Promise<string> {
  const element = await CareerArticlePage({ params: Promise.resolve({ id: ARTICLE_ID }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchCareerArticle.mockResolvedValue(makeArticle());
  mocks.mockFetchCareerArticles.mockResolvedValue({
    items: [makeRelated()],
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
  mocks.mockSelectRelatedArticles.mockReturnValue([makeRelated()]);
});

describe("CareerArticlePage", () => {
  it("renders breadcrumb with Home, Career resources, and the article title", async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/careers"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the article title as a single H1", async () => {
    const html = await renderPage();
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain("How to Write a Strong CV");
  });

  it("renders the category link, publish date, excerpt, and content", async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="/careers?category=Resume%20tips"');
    expect(html).toContain("Published 2026-01-10");
    expect(html).toContain("Practical steps to build a standout CV.");
    expect(html).toContain("Start with a clear summary.");
    expect(html).toContain("Then list your experience.");
  });

  it("renders related articles with links", async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="/careers/art-2"');
    expect(html).toContain("Interview Preparation");
    expect(html).toContain("Published 2026-02-01");
  });

  it("hides the related section when there are no related articles", async () => {
    mocks.mockSelectRelatedArticles.mockReturnValue([]);
    const html = await renderPage();
    expect(html).not.toContain("More in");
    expect(html).not.toContain("Interview Preparation");
  });

  it("renders a back link to all career resources", async () => {
    const html = await renderPage();
    expect(html).toContain("Browse all career resources");
    expect(html).toContain('data-testid="/careers"');
  });

  it("shows a retry state when the article fails to load", async () => {
    mocks.mockFetchCareerArticle.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load this article right now");
    expect(html).toContain("Back to Career Resources");
  });

  it("calls notFound when the article does not exist", async () => {
    mocks.mockFetchCareerArticle.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });
});