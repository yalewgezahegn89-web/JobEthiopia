import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchCareerArticles,
  type PublicArticleList,
  type PublicArticleSummary,
} from "@/lib/careerArticles/public";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { PageHeader } from "@/components/public/page-header";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { BookIcon, CalendarIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Career Resources | JobEthiopia",
  description: "Career advice and resources for Ethiopian job seekers.",
};

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamsValue>;

function firstValue(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function uniqueSortedCategories(items: PublicArticleSummary[]): string[] {
  const categories = items
    .map((item) => item.category)
    .filter((category): category is string => Boolean(category));
  return [...new Set(categories)].sort((a, b) => a.localeCompare(b));
}

export default async function CareersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const category = firstValue(params.category);
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicArticleList | null = null;
  let loadError = false;

  try {
    result = await fetchCareerArticles({
      category,
      page,
      limit: 20,
    });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Career Resources</h1>
        <p className="mt-4 text-muted">
          We could not load career resources right now. Please try again
          shortly.
        </p>
        <Link
          href="/careers"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Retry
        </Link>
      </div>
    );
  }

  const items = result?.items ?? [];
  const pagination =
    result?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;

  const categories = uniqueSortedCategories(items);
  const featured = items[0] ?? null;
  const rest = featured ? items.slice(1) : items;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    if (category) {
      query.set("category", category);
    }
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Careers" }]} />

      <div className="mt-4">
        <PageHeader
          eyebrow="Career resources"
          title="Career resources"
          description="Practical advice and guidance to help you grow your career and land the right role."
        />
      </div>

      {categories.length > 0 && (
        <nav
          aria-label="Article categories"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
            {category && (
              <Link
                href="/careers"
                className="inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                All
              </Link>
            )}
            {categories.map((name) => {
              const active = category === name;
              return (
                <Link
                  key={name}
                  href={active ? "/careers" : `/careers?category=${encodeURIComponent(name)}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    active
                      ? "bg-primary text-white"
                      : "border border-border bg-surface text-muted hover:bg-surface-raised"
                  }`}
                >
                  {name}
                </Link>
              );
            })}
        </nav>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<BookIcon className="h-7 w-7" />}
          heading="No career resources yet"
          body="Try a different category or check back later."
        />
      ) : (
        <>
          {featured && <FeaturedArticle article={featured} />}

          {rest.length > 0 && (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((article) => (
                <li key={article.id} className="h-full">
                  <ArticleCard article={article} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            hrefForPage={hrefWithPage}
          />
        </>
      )}
    </div>
  );
}

function FeaturedArticle({
  article,
}: {
  article: PublicArticleSummary;
}) {
  return (
    <article className="group mt-8 rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex items-center justify-center rounded-t-xl bg-accent-light lg:rounded-l-xl lg:rounded-tr-none">
          <BookIcon className="h-14 w-14 text-warning" />
        </div>
        <div className="p-6 sm:p-7">
          {article.category && (
            <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold text-warning">
              {article.category}
            </span>
          )}
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            <Link
              href={`/careers/${article.id}`}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary group-hover:text-primary"
            >
              {article.title}
            </Link>
          </h2>
          {article.excerpt && (
            <p className="mt-2 line-clamp-3 text-base leading-7 text-muted">
              {article.excerpt}
            </p>
          )}
          {article.publishedAt && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-subtle">
              <CalendarIcon className="h-3.5 w-3.5" />
              Published {article.publishedAt}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function ArticleCard({ article }: { article: PublicArticleSummary }) {
  return (
    <Link
      href={`/careers/${article.id}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex items-center gap-2">
        {article.category && (
          <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold text-warning">
            {article.category}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
          {article.excerpt}
        </p>
      )}
      {article.publishedAt && (
        <p className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs text-subtle">
          <CalendarIcon className="h-3.5 w-3.5" />
          Published {article.publishedAt}
        </p>
      )}
    </Link>
  );
}