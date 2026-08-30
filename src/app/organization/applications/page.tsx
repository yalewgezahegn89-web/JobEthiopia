import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/context";
import {
  listEmployerApplications,
  listEmployerJobsForFilter,
} from "@/lib/employer/applications";
import type { ApplicationStatus } from "@/lib/applications/dal";
import type { ApplicationSort } from "@/lib/employer/applications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Applications | JobEthiopia Employer",
  description: "Review applications submitted to your organization's jobs.",
};

export default async function EmployerApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    jobId?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const params = await searchParams;
  const VALID_STATUSES: ApplicationStatus[] = [
    "SUBMITTED",
    "WITHDRAWN",
    "REVIEWING",
    "SHORTLISTED",
    "REJECTED",
  ];
  const status: ApplicationStatus | undefined =
    params.status && VALID_STATUSES.includes(params.status as ApplicationStatus)
      ? (params.status as ApplicationStatus)
      : undefined;

  const jobId =
    params.jobId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      params.jobId,
    )
      ? params.jobId
      : undefined;

  const VALID_SORTS: ApplicationSort[] = ["newest", "oldest", "updated"];
  const sort: ApplicationSort =
    params.sort && VALID_SORTS.includes(params.sort as ApplicationSort)
      ? (params.sort as ApplicationSort)
      : "newest";

  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;

  let items: Awaited<ReturnType<typeof listEmployerApplications>>["items"] = [];
  let total = 0;
  let totalPages = 1;
  let loadError = false;
  let jobOptions: { id: string; title: string }[] = [];

  try {
    const [result, jobs] = await Promise.all([
      listEmployerApplications(user.id, {
        status,
        jobId,
        sort,
        page,
        limit: 20,
      }),
      listEmployerJobsForFilter(user.id),
    ]);
    items = result.items;
    total = result.total;
    totalPages = result.totalPages;
    jobOptions = jobs;
  } catch {
    loadError = true;
  }

  const hasActiveFilters = !!status || !!jobId || sort !== "newest";

  function buildFilterUrl(
    overrides: Partial<{
      status: string | undefined;
      jobId: string | undefined;
      sort: string | undefined;
      page: number;
    }> = {},
  ) {
    const p = new URLSearchParams();
    const nextStatus = overrides.status !== undefined ? overrides.status : status;
    const nextJobId = overrides.jobId !== undefined ? overrides.jobId : jobId;
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort;
    const nextPage = overrides.page ?? 1;

    if (nextStatus) p.set("status", nextStatus);
    if (nextJobId) p.set("jobId", nextJobId);
    if (nextSort && nextSort !== "newest") p.set("sort", nextSort);
    if (nextPage > 1) p.set("page", String(nextPage));
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  function statusBadge(s: string) {
    const colors: Record<string, string> = {
      SUBMITTED: "bg-blue-100 text-blue-800",
      WITHDRAWN: "bg-gray-100 text-gray-600",
      REVIEWING: "bg-yellow-100 text-yellow-800",
      SHORTLISTED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[s] ?? "bg-gray-100 text-gray-600"}`}
      >
        {s}
      </span>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        Applications
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Applications submitted to your organization&apos;s jobs.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">All statuses</option>
            {["SUBMITTED", "REVIEWING", "SHORTLISTED", "REJECTED", "WITHDRAWN"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
        </label>
        {jobOptions.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            Job
            <select
              name="jobId"
              defaultValue={jobId ?? ""}
              className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="">All jobs</option>
              {jobOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Sort
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-700"
        >
          Filter
        </button>
        {hasActiveFilters && (
          <Link
            href="/organization/applications"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
          >
            Clear filters
          </Link>
        )}
      </form>

      {loadError ? (
        <div className="mt-6 rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-400">
            Could not load applications. Please try again shortly.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-400">
            No applications found.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-500">
            {total} application{total === 1 ? "" : "s"} total
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/organization/applications/${item.id}`}
                        className="font-medium text-gray-900 hover:underline dark:text-gray-100"
                      >
                        {item.jobTitle}
                      </Link>
                      {statusBadge(item.status)}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {item.candidateName} &middot; {item.candidateEmail}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.organizationName}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>{new Date(item.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {page > 1 && (
                  <a
                    href={buildFilterUrl({ page: page - 1 })}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                  >
                    Previous
                  </a>
                )}
              </div>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                {page < totalPages && (
                  <a
                    href={buildFilterUrl({ page: page + 1 })}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                  >
                    Next
                  </a>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
