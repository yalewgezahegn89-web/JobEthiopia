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
import { BulkApplicationActions } from "@/components/employer/bulk-application-actions";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { EmptyState } from "@/components/public/empty-state";
import { UserIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Applications | JobEthiopia Employer",
  description: "Review applications submitted to your organization's jobs.",
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  REVIEWING: "Reviewing",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const selectClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Home", href: "/organization" }, { label: "Applications" }]}
      />

      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Employer workspace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Applications
        </h1>
        <p className="mt-1 text-sm text-muted">
          Applications submitted to your organization&apos;s jobs.
        </p>
      </div>

      <form
        method="get"
        className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {["SUBMITTED", "REVIEWING", "SHORTLISTED", "REJECTED", "WITHDRAWN"].map(
              (s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ),
            )}
          </select>
        </label>
        {jobOptions.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Job</span>
            <select
              name="jobId"
              defaultValue={jobId ?? ""}
              className={selectClass}
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
          <span className="font-medium text-foreground">Sort</span>
          <select
            name="sort"
            defaultValue={sort}
            className={selectClass}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Filter
          </button>
          {hasActiveFilters && (
            <Link
              href="/organization/applications"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {loadError ? (
        <EmptyState
          icon={<UserIcon className="h-7 w-7" />}
          heading="Applications"
          body="Could not load applications. Please try again shortly."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-7 w-7" />}
          heading="No applications found"
          body="No applications match your current filters."
        />
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {`${total} application${total === 1 ? "" : "s"} total`}
          </p>
          <BulkApplicationActions
            key={`${status ?? "all"}-${jobId ?? "all"}-${sort}-${page}`}
            applications={items.map((item) => ({
              id: item.id,
              jobId: item.jobId,
              jobTitle: item.jobTitle,
              organizationName: item.organizationName,
              candidateName: item.candidateName,
              candidateEmail: item.candidateEmail,
              status: item.status,
              createdAt: item.createdAt.toISOString(),
            }))}
          />
          {totalPages > 1 && (
            <nav
              aria-label="Applications pagination"
              className="mt-4 flex items-center justify-between gap-3"
            >
              <div className="flex gap-1">
                {page > 1 && (
                  <a
                    href={buildFilterUrl({ page: page - 1 })}
                    className="focus-visible:outline-2 rounded-lg border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Previous
                  </a>
                )}
              </div>
              <span className="text-sm text-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                {page < totalPages && (
                  <a
                    href={buildFilterUrl({ page: page + 1 })}
                    className="focus-visible:outline-2 rounded-lg border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
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
