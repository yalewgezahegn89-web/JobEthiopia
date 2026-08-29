import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLocations,
  type PublicLocationList,
} from "@/lib/locations/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations | JobEthiopia",
  description: "Browse job locations across Ethiopia.",
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

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicLocationList | null = null;
  let loadError = false;

  try {
    result = await fetchLocations({ page, limit: 20 });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Locations</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load locations right now. Please try again shortly.
        </p>
        <Link
          href="/locations"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Retry
        </Link>
      </div>
    );
  }

  const items = result?.items ?? [];
  const pagination = result?.pagination ?? {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-300">
        Browse job locations across Ethiopia.
      </p>

      {items.length === 0 ? (
        <div
          className="mt-10 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
          role="status"
        >
          <h2 className="text-lg font-semibold">No locations found</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            There are no active locations to show right now.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map((location) => (
              <li key={location.id}>
                <Link
                  href={`/locations/${location.id}`}
                  className="block h-full rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                    {location.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                      {location.type.replace("_", " ")}
                    </span>
                  </div>
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
