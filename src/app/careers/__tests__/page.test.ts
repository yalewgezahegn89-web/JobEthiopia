import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchCareerArticles: vi.fn(),
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
    fetchCareerArticles: (...a: unknown[]) => mocks.mockFetchCareerArticles(...a),
  };
});

import CareersPage from "@/app/careers/page";

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: "art-1",
    title: "How to Write a Strong CV",
    slug: "how-to-write-a-strong-cv",
    category: "Resume tips",
    excerpt: "Practical steps to build a standout CV.",
    publishedAt: "2026-01-10",
    ...overrides,
  };
}

async function renderPage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const element = await CareersPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CareersPage", () => {
  it("renders breadcrumb and page header", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("Career resources");
    expect(html).toContain("Career resources");
  });

  it("renders the first article as a featured card", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [makeArticle()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("How to Write a Strong CV");
    expect(html).toContain("Resume tips");
    expect(html).toContain("Published 2026-01-10");
    expect(html).toContain('data-testid="/careers/art-1"');
  });

  it("renders remaining articles as cards", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [
        makeArticle(),
        makeArticle({ id: "art-2", title: "Interview Preparation", slug: "interview-preparation" }),
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("How to Write a Strong CV");
    expect(html).toContain("Interview Preparation");
    expect(html).toContain('data-testid="/careers/art-2"');
  });

  it("renders category filter pills derived from the article data", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [
        makeArticle(),
        makeArticle({ id: "art-2", category: "Interviewing", title: "Interview Preparation" }),
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain('aria-label="Article categories"');
    expect(html).toContain('data-testid="/careers?category=Resume%20tips"');
    expect(html).toContain('data-testid="/careers?category=Interviewing"');
  });

  it("marks the active category pill and links back to all articles", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [makeArticle()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage({ category: "Resume tips" });
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-testid="/careers"');
  });

  it("renders the empty state when there are no articles", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No career resources yet");
  });

  it("renders pagination links on multiple pages", async () => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [makeArticle()],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const html = await renderPage();
    expect(html).toContain("?page=1");
    expect(html).toContain("Next");
  });

  it("renders a retry state when loading fails", async () => {
    mocks.mockFetchCareerArticles.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load career resources right now");
    expect(html).toContain("Retry");
  });
});