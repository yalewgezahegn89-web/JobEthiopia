import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchJobs,
  type PublicJobList,
  type PublicJobSummary,
} from "@/lib/jobs/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs | JobEthiopia",
  description: "Browse job openings across Ethiopia.",
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

type FilterOption = { id: string; name: string };

function uniqueFilterOptions(
  items: PublicJobSummary[],
  pickId: (item: PublicJobSummary) => string | null,
  pickName: (item: PublicJobSummary) => string | null,
): FilterOption[] {
  const byId = new Map<string, string>();
  for (const item of items) {
    const id = pickId(item);
    const name = pickName(item);
    if (id && name) {
      byId.set(id, name);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uniqueEmploymentTypes(items: PublicJobSummary[]): string[] {
  const values = items
    .map((item) => item.employmentType)
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const q = firstValue(params.q) ?? "";
  const categoryId = firstValue(params.categoryId);
  const professionId = firstValue(params.professionId);
  const locationId = firstValue(params.locationId);
  const employmentType = firstValue(params.employmentType);
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicJobList | null = null;
  let loadError = false;

  try {
    result = await fetchJobs({
      q: q || undefined,
      categoryId,
      professionId,
      locationId,
      employmentType,
      page,
      limit: 20,
    });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load jobs right now. Please try again shortly.
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Retry
        </Link>
      </div>
    );
  }

  const items = result?.items ?? [];
  const pagination = result?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;

  const categories = uniqueFilterOptions(
    items,
    (item) => item.categoryId,
    (item) => item.categoryName,
  );
  const professions = uniqueFilterOptions(
    items,
    (item) => item.professionId,
    (item) => item.professionName,
  );
  const locations = uniqueFilterOptions(
    items,
    (item) => item.locationId,
    (item) => item.locationName,
  );
  const employmentTypes = uniqueEmploymentTypes(items);

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    if (q) {
      query.set("q", q);
    }
    if (categoryId) {
      query.set("categoryId", categoryId);
    }
    if (professionId) {
      query.set("professionId", professionId);
    }
    if (locationId) {
      query.set("locationId", locationId);
    }
    if (employmentType) {
      query.set("employmentType", employmentType);
    }
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-300">
        Browse job openings across Ethiopia.
      </p>

      <form
        action="/jobs"
        method="get"
        className="mt-6 flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <label htmlFor="q" className="text-sm font-semibold">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search jobs by keyword"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="categoryId" className="text-sm font-semibold">
              Category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={categoryId ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">Any</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="professionId" className="text-sm font-semibold">
              Profession
            </label>
            <select
              id="professionId"
              name="professionId"
              defaultValue={professionId ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">Any</option>
              {professions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="locationId" className="text-sm font-semibold">
              Location
            </label>
            <select
              id="locationId"
              name="locationId"
              defaultValue={locationId ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">Any</option>
              {locations.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="employmentType" className="text-sm font-semibold">
              Employment Type
            </label>
            <select
              id="employmentType"
              name="employmentType"
              defaultValue={employmentType ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">Any</option>
              {employmentTypes.map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {(q || categoryId || professionId || locationId || employmentType) && (
            <Link
              href="/jobs"
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              Clear filters
            </Link>
          )}
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Search
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <div
          className="mt-10 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
          role="status"
        >
          <h2 className="text-lg font-semibold">No jobs found</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Try adjusting your search or clearing the filters.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {items.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                    {job.organizationName ?? "Unknown organization"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                    {job.locationName && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        {job.locationName}
                      </span>
                    )}
                    {job.categoryName && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        {job.categoryName}
                      </span>
                    )}
                    {job.professionName && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        {job.professionName}
                      </span>
                    )}
                    {job.employmentType && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        {job.employmentType.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {(job.salaryText || job.deadlineText) && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {job.salaryText && <span>{job.salaryText}</span>}
                      {job.salaryText && job.deadlineText && (
                        <span className="mx-1">·</span>
                      )}
                      {job.deadlineText && (
                        <span>
                          Deadline: <time>{job.deadlineText}</time>
                        </span>
                      )}
                    </div>
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