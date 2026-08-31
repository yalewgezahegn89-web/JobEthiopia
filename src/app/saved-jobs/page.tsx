import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { listSavedJobs } from "@/lib/savedJobs/dal";
import { SavedJobList } from "@/components/saved-jobs/saved-job-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Jobs | JobEthiopia",
  description: "Jobs you have saved on JobEthiopia.",
  robots: "noindex, nofollow",
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

export default async function SavedJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect("/jobs");

  const page = toPositiveInteger(firstValue(params.page), 1);

  let result;
  let loadError = false;
  try {
    result = await listSavedJobs(user.id, { page, limit: 20 });
  } catch {
    loadError = true;
  }

  const items = result?.items ?? [];
  const currentPage = result?.page ?? 1;
  const totalPages = result?.totalPages ?? 1;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Saved Jobs</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Jobs you have saved for later.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/jobs"
          className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Browse Jobs
        </Link>
        <Link
          href="/applications"
          className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          My Applications
        </Link>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-300">
            We could not load your saved jobs right now. Please try again shortly.
          </p>
          <Link
            href="/saved-jobs"
            className="mt-4 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
          >
            Retry
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-300">
            You have no saved jobs yet.
          </p>
          <Link
            href="/jobs"
            className="mt-4 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
          >
            Browse jobs
          </Link>
        </div>
      ) : (
        <>
          <SavedJobList items={items} />

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
