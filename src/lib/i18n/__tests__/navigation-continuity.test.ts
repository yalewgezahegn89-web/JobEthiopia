// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/client";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const mocks = vi.hoisted(() => ({
  mockPathname: vi.fn(),
  mockSearch: vi.fn(),
  mockGetCurrentLocale: vi.fn(),
  mockGetI18n: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockFetchCareerArticles: vi.fn(),
  mockFetchCareerArticle: vi.fn(),
  mockSelectRelatedArticles: vi.fn(),
  mockTrackPageView: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => createElement("a", props as Record<string, unknown>, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.mockPathname(),
  useSearchParams: () => new URLSearchParams(mocks.mockSearch()),
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/lib/i18n/server", () => ({
  getCurrentLocale: () => mocks.mockGetCurrentLocale(),
  getI18n: () => mocks.mockGetI18n(),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/careerArticles/public", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/careerArticles/public")>();
  return {
    ...actual,
    fetchCareerArticles: (...args: unknown[]) =>
      mocks.mockFetchCareerArticles(...args),
    fetchCareerArticle: (...args: unknown[]) =>
      mocks.mockFetchCareerArticle(...args),
  };
});

vi.mock("@/lib/careerArticles/related", () => ({
  selectRelatedArticles: (...args: unknown[]) =>
    mocks.mockSelectRelatedArticles(...args),
}));

vi.mock("@/lib/analytics/pageEvents", () => ({
  trackPageView: (...args: unknown[]) => mocks.mockTrackPageView(...args),
}));

import { LocalizedLink } from "@/components/i18n/localized-link";
import { LanguageSwitcher } from "@/components/language-switcher";
import SiteHeader from "@/components/site-header";
import { MobileHeader } from "@/components/mobile-header";
import SiteFooter from "@/components/site-footer";
import { Breadcrumb } from "@/components/public/breadcrumb";
import JobCard from "@/components/job-card";
import { Hero } from "@/components/homepage/hero";
import { LatestJobs } from "@/components/homepage/jobs";
import { CareerResources } from "@/components/homepage/career-resources";
import { EmployerCta } from "@/components/homepage/employer-cta";
import { ExploreByPath } from "@/components/homepage/explore";
import AuthLegalLinks from "@/components/legal/auth-legal-links";
import CareersPage from "@/app/careers/page";
import CareerArticlePage from "@/app/careers/[id]/page";

const CASES = [
  { locale: "en" as const, prefix: "" },
  { locale: "am" as const, prefix: "/am" },
  { locale: "om" as const, prefix: "/om" },
];

function expected(locale: Locale, path: string): string {
  if (path === "/") return locale === "en" ? "/" : `/${locale}`;
  return `${locale === "en" ? "" : `/${locale}`}${path}`;
}

function withProvider(element: ReactNode, locale: Locale): ReactNode {
  // eslint-disable-next-line react/no-children-prop -- I18nProvider requires an explicit children prop in createElement
  return createElement(I18nProvider, { locale, children: element });
}

function renderStatic(element: ReactNode, locale: Locale): string {
  return renderToStaticMarkup(withProvider(element, locale));
}

async function renderServer(
  factory: () => Promise<ReactNode>,
  locale: Locale,
): Promise<string> {
  mocks.mockGetCurrentLocale.mockResolvedValue(locale);
  mocks.mockGetI18n.mockResolvedValue(dictionaries[locale]);
  mocks.mockGetCurrentUser.mockResolvedValue(null);
  return renderStatic(await factory(), locale);
}

function makeJob() {
  return {
    id: "job-1",
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    organizationName: "ACME Plc",
    organizationLogoUrl: null,
    locationName: "Addis Ababa",
    categoryName: "Finance",
    professionName: "Accounting",
    employmentType: "FULL_TIME",
    salaryText: "30,000 ETB",
    deadlineText: "Mar 15, 2099",
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: "2099-03-15T00:00:00.000Z",
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
  };
}

function makeArticle() {
  return {
    id: "article-1",
    title: "CV tips",
    slug: "cv-tips",
    category: "Job search",
    excerpt: "A short guide.",
    publishedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockPathname.mockReturnValue("/");
  mocks.mockSearch.mockReturnValue("");
  mocks.mockTrackPageView.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("localized href primitive", () => {
  it.each(CASES)("localizes internal hrefs in $locale", ({ locale, prefix }) => {
    const html = renderStatic(
      createElement(
        LocalizedLink,
        { href: "/jobs?page=2#results" },
        "Jobs",
      ),
      locale,
    );
    expect(html).toContain(`href="${prefix}/jobs?page=2#results"`);
  });

  it("does not rewrite external, API, static, or relative destinations", () => {
    const hrefs = [
      "https://example.com/apply",
      "/api/auth/google/start?locale=am",
      "/images/logo.png",
      "mailto:jobs@example.com",
      "?page=2",
      "#results",
    ];
    const html = renderStatic(
      createElement(
        Fragment,
        null,
        ...hrefs.map((href) =>
          createElement(LocalizedLink, { href, key: href }, href),
        ),
      ),
      "am",
    );

    for (const href of hrefs) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="/am/api');
    expect(html).not.toContain('href="/am/images');
  });
});

describe("breadcrumb navigation continuity", () => {
  it.each(CASES)("uses $locale breadcrumb destinations", ({ locale }) => {
    const html = renderStatic(
      createElement(Breadcrumb, {
        items: [
          { label: "Home", href: "/" },
          { label: "Jobs", href: "/jobs?categoryId=7" },
          { label: "Current" },
        ],
        t: dictionaries[locale],
      }),
      locale,
    );

    expect(html).toContain(`href="${expected(locale, "/")}"`);
    expect(html).toContain(`href="${expected(locale, "/jobs")}?categoryId=7"`);
    expect(html).toContain('aria-label="Breadcrumb"');
  });
});

describe("job card navigation continuity", () => {
  it.each(CASES)("uses $locale job detail links", ({ locale }) => {
    const html = renderStatic(
      createElement(JobCard, { job: makeJob(), t: dictionaries[locale] }),
      locale,
    );
    expect(html).toContain(`href="${expected(locale, "/jobs/job-1")}"`);
  });
});

describe("homepage navigation continuity", () => {
  it.each(CASES)("localizes homepage CTAs and taxonomy links in $locale", ({ locale }) => {
    const html = renderStatic(
      createElement(
        Fragment,
        null,
        createElement(Hero, {
          searchAction: expected(locale, "/jobs"),
          locations: [
            {
              id: "loc-1",
              name: "Addis Ababa",
              slug: "addis-ababa",
              type: "CITY",
              parentId: null,
              isActive: true,
            },
          ],
          t: dictionaries[locale],
        }),
        createElement(LatestJobs, { jobs: [makeJob()], t: dictionaries[locale] }),
        createElement(CareerResources, {
          articles: [makeArticle()],
          t: dictionaries[locale],
        }),
        createElement(EmployerCta, { t: dictionaries[locale] }),
        createElement(ExploreByPath, {
          professions: [
            {
              id: "prof-1",
              name: "Accounting",
              slug: "accounting",
              description: null,
              categoryId: null,
              isActive: true,
            },
          ],
          categories: [
            {
              id: "cat-1",
              name: "Finance",
              slug: "finance",
              description: null,
              parentId: null,
              isActive: true,
              sortOrder: null,
            },
          ],
          locations: [
            {
              id: "loc-1",
              name: "Addis Ababa",
              slug: "addis-ababa",
              type: "CITY",
              parentId: null,
              isActive: true,
            },
          ],
          t: dictionaries[locale],
        }),
      ),
      locale,
    );

    expect(html).toContain(`action="${expected(locale, "/jobs")}"`);
    for (const path of [
      "/professions",
      "/categories",
      "/locations",
      "/employer/register",
      "/professions/prof-1",
      "/categories/cat-1",
      "/locations/loc-1",
      "/careers",
      "/careers/article-1",
    ]) {
      expect(html).toContain(`href="${expected(locale, path)}"`);
    }
  });
});

describe("career article navigation continuity", () => {
  const articles = [
    {
      id: "art-1",
      title: "CV tips",
      slug: "cv-tips",
      category: "Resume tips",
      excerpt: "A short guide.",
      publishedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "art-2",
      title: "Interview tips",
      slug: "interview-tips",
      category: "Interviewing",
      excerpt: "Another guide.",
      publishedAt: "2026-02-01T00:00:00.000Z",
    },
  ];

  it.each(CASES)("localizes career listing links in $locale", async ({ locale }) => {
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: articles,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 2 },
    });

    const html = await renderServer(
      () => CareersPage({ searchParams: Promise.resolve({}) }),
      locale,
    );

    expect(html).toContain(`href="${expected(locale, "/")}"`);
    expect(html).toContain(`href="${expected(locale, "/careers/art-1")}"`);
    expect(html).toContain(`href="${expected(locale, "/careers/art-2")}"`);
    expect(html).toContain(
      `href="${expected(locale, "/careers?category=Resume%20tips")}"`,
    );
    // Query-only pagination stays relative to the current localized route.
    expect(html).toContain('href="?page=2"');
  });

  it.each(CASES)("localizes career detail links in $locale", async ({ locale }) => {
    mocks.mockFetchCareerArticle.mockResolvedValue({
      ...articles[0],
      content: "Body",
      status: "PUBLISHED",
    });
    mocks.mockFetchCareerArticles.mockResolvedValue({
      items: [articles[1]],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
    });
    mocks.mockSelectRelatedArticles.mockReturnValue([articles[1]]);

    const html = await renderServer(
      () => CareerArticlePage({ params: Promise.resolve({ id: "art-1" }) }),
      locale,
    );

    expect(html).toContain(`href="${expected(locale, "/")}"`);
    expect(html).toContain(`href="${expected(locale, "/careers")}"`);
    expect(html).toContain(
      `href="${expected(locale, "/careers?category=Resume%20tips")}"`,
    );
    expect(html).toContain(`href="${expected(locale, "/careers/art-2")}"`);
  });
});

describe("header and footer navigation continuity", () => {
  it.each(CASES)("localizes desktop header links in $locale", async ({ locale }) => {
    mocks.mockPathname.mockReturnValue(
      locale === "en" ? "/jobs" : `/${locale}/jobs`,
    );
    const html = await renderServer(() => SiteHeader(), locale);

    for (const path of [
      "/",
      "/jobs",
      "/organizations",
      "/careers",
      "/categories",
      "/professions",
      "/locations",
      "/login",
      "/register",
    ]) {
      expect(html).toContain(`href="${expected(locale, path)}"`);
    }
    expect(html).toMatch(
      new RegExp(
        `<a[^>]*href="${expected(locale, "/jobs")}"[^>]*aria-current="page"`,
      ),
    );
  });

  it.each(CASES)("localizes footer and legal links in $locale", async ({ locale }) => {
    const html = await renderServer(() => SiteFooter(), locale);

    for (const path of [
      "/",
      "/jobs",
      "/organizations",
      "/categories",
      "/professions",
      "/locations",
      "/careers",
      "/contact",
      "/privacy",
      "/terms",
      "/cookies",
    ]) {
      expect(html).toContain(`href="${expected(locale, path)}"`);
    }
    expect(html).toContain('href="https://t.me/jobethiopiaet"');
    expect(html).toContain('href="https://www.facebook.com/JobEthiopiaET"');
  });

  it.each(CASES)("localizes auth legal links in $locale", ({ locale }) => {
    const html = renderStatic(
      createElement(AuthLegalLinks, { labels: dictionaries[locale].legalNav }),
      locale,
    );
    for (const path of ["/privacy", "/terms", "/cookies"]) {
      expect(html).toContain(`href="${expected(locale, path)}"`);
    }
  });
});

describe("mobile navigation continuity", () => {
  it.each(CASES)("localizes mobile nav links and active state in $locale", ({ locale }) => {
    mocks.mockPathname.mockReturnValue(
      locale === "en" ? "/jobs" : `/${locale}/jobs`,
    );

    render(
      withProvider(
        createElement(MobileHeader, {
          userInfo: null,
          roleLinks: [],
          primaryLinks: [
            { href: "/", label: "Home" },
            { href: "/jobs", label: "Jobs" },
          ],
          anonymousLinks: [{ href: "/login", label: "Login" }],
        }),
        locale,
      ),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: dictionaries[locale].nav.openMenu,
      }),
    );

    const jobs = screen.getByRole("link", { name: "Jobs" });
    expect(jobs.getAttribute("href")).toBe(expected(locale, "/jobs"));
    expect(jobs.getAttribute("aria-current")).toBe("page");

    const login = screen.getByRole("link", { name: "Login" });
    expect(login.getAttribute("href")).toBe(expected(locale, "/login"));
  });
});

describe("language switching continuity", () => {
  it.each([
    { locale: "en" as const, pathname: "/jobs" },
    { locale: "am" as const, pathname: "/am/jobs" },
    { locale: "om" as const, pathname: "/om/jobs" },
  ])("keeps the current route and query when switching from $locale", ({ locale, pathname }) => {
    mocks.mockPathname.mockReturnValue(pathname);
    mocks.mockSearch.mockReturnValue("q=engineer");

    const html = renderStatic(createElement(LanguageSwitcher), locale);

    expect(html).toContain('href="/jobs?q=engineer"');
    expect(html).toContain('href="/am/jobs?q=engineer"');
    expect(html).toContain('href="/om/jobs?q=engineer"');
  });
});

describe("unchanged English behavior", () => {
  it("keeps canonical unprefixed destinations", () => {
    const html = renderStatic(
      createElement(
        Fragment,
        null,
        createElement(LocalizedLink, { href: "/" }, "Home"),
        createElement(LocalizedLink, { href: "/jobs?page=2" }, "Jobs"),
        createElement(LocalizedLink, { href: "/privacy" }, "Privacy"),
      ),
      "en",
    );

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/jobs?page=2"');
    expect(html).toContain('href="/privacy"');
    expect(html).not.toContain('href="/en/');
  });
});
