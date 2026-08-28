import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchCareerArticles,
  type PublicArticleList,
  type PublicArticleSummary,
} from "@/lib/careerArticles/public";

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
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Career Resources</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load career resources right now. Please try again
          shortly.
        </p>
        <Link
          href="/careers"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
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

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    if (category) {
      query.set("category", category);
    }
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Career Resources</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-300">
        Career advice and resources to help you grow.
      </p>

      <form
        action="/careers"
        method="get"
        className="mt-6 flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-2">
            <label htmlFor="category" className="text-sm font-semibold">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={category ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {category && (
              <Link
                href="/careers"
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              >
                Clear filters
              </Link>
            )}
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              Filter
            </button>
          </div>
        </div>
      </form>

      {items.length === 0 ? (
        <div
          className="mt-10 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
          role="status"
        >
          <h2 className="text-lg font-semibold">No articles found</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Try a different category or check back later.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {items.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/careers/${article.id}`}
                  className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                    {article.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                    {article.category && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        {article.category}
                      </span>
                    )}
                    {article.publishedAt && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        Published {article.publishedAt}
                      </span>
                    )}
                  </div>
                  {article.excerpt && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {article.excerpt}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav
              className="mt-8 flex items-center justify-between gap-4"
              aria-label="Pagination"
            >
              {currentPage > 1 ? (
                <Link
                  href={hrefWithPage(currentPage - 1)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 dark:border-gray-800 dark:text-gray-600">
                  Previous
                </span>
              )}

              <span className="text-sm text-gray-600 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={hrefWithPage(currentPage + 1)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 dark:border-gray-800 dark:text-gray-600">
                  Next
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}