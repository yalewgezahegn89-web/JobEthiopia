import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { listEmployerJobs } from "@/lib/employer/jobs";
import { Badge } from "@/components/ui/badge";
import {
  BriefcaseIcon,
  PlusIcon,
  ArrowRightIcon,
} from "@/components/public/icons";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { EmptyState } from "@/components/public/empty-state";

export const dynamic = "force-dynamic";

const JOB_STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  DRAFT: { label: "Draft", variant: "default" },
  PENDING_REVIEW: { label: "Pending review", variant: "warning" },
  PUBLISHED: { label: "Published", variant: "success" },
  EXPIRED: { label: "Expired", variant: "destructive" },
  REMOVED: { label: "Removed", variant: "destructive" },
};

const VALID_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "EXPIRED",
  "REMOVED",
] as const;

type JobStatus = (typeof VALID_STATUSES)[number];

function formatDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function EmployerJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) redirect("/login");

  const user = await verifySession(rawToken);
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const params = await searchParams;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const pageParam = typeof params.page === "string" ? params.page : undefined;

  const status = VALID_STATUSES.includes(statusParam as JobStatus)
    ? (statusParam as JobStatus)
    : undefined;
  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;

  let result;
  try {
    result = await listEmployerJobs(user.id, { status, page, limit: 20 });
  } catch {
    return (
      <EmptyState
        icon={<BriefcaseIcon className="h-7 w-7" />}
        heading="Jobs"
        body="Unable to load jobs. Please try again."
      />
    );
  }

  function statusUrl(s: JobStatus | undefined): string {
    return s ? `/organization/jobs?status=${s}` : "/organization/jobs";
  }

  const filterStatus: JobStatus | undefined = status;

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Home", href: "/organization" }, { label: "Jobs" }]}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Job management
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage and review your organization&apos;s job listings.
          </p>
        </div>
        <Link
          href="/organization/jobs/create"
          className="focus-visible:outline-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <PlusIcon className="h-4 w-4" />
          Create Job
        </Link>
      </div>

      <div className="mt-6 flex flex-nowrap gap-2 overflow-x-auto pb-1">
        <Link
          href={statusUrl(undefined)}
          aria-current={!filterStatus ? "page" : undefined}
          className={`focus-visible:outline-2 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            !filterStatus
              ? "bg-primary text-white"
              : "bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          All
        </Link>
        {VALID_STATUSES.map((s) => (
          <Link
            key={s}
            href={statusUrl(s)}
            aria-current={filterStatus === s ? "page" : undefined}
            className={`focus-visible:outline-2 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              filterStatus === s
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            {JOB_STATUS_META[s].label}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon className="h-7 w-7" />}
          heading="No jobs found"
          body="Create your first job to start receiving applications."
          ctaHref="/organization/jobs/create"
          ctaLabel="Create job"
        />
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="px-4 py-3 font-semibold text-subtle">Title</th>
                    <th className="px-4 py-3 font-semibold text-subtle">
                      Organization
                    </th>
                    <th className="px-4 py-3 font-semibold text-subtle">Status</th>
                    <th className="px-4 py-3 font-semibold text-subtle">
                      Applications
                    </th>
                    <th className="px-4 py-3 font-semibold text-subtle">
                      Deadline
                    </th>
                    <th className="px-4 py-3 font-semibold text-subtle">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-subtle">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {result.items.map((job) => {
                    const meta = JOB_STATUS_META[job.status] ?? {
                      label: job.status.replace("_", " "),
                      variant: "default" as const,
                    };
                    return (
                      <tr
                        key={job.id}
                        className="transition-colors duration-150 hover:bg-surface-raised/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/organization/jobs/${job.id}`}
                            className="focus-visible:outline-2 block font-semibold text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary hover:text-primary"
                          >
                            {job.title}
                          </Link>
                          {job.status === "PENDING_REVIEW" && (
                            <span className="mt-1 block text-xs text-warning">
                              Awaiting staff review
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {job.organizationName}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <span className="sr-only">{job.status}</span>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          <span className="font-medium text-foreground">
                            {job.applicationCount}
                          </span>
                          {job.needsReviewCount > 0 && (
                            <span className="ml-2 inline-block rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
                              {`${job.needsReviewCount} to review`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDate(job.deadline)}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDate(job.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/organization/jobs/${job.id}`}
                              className="focus-visible:outline-2 inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              View
                              <ArrowRightIcon className="h-3.5 w-3.5" />
                            </Link>
                            {(job.status === "DRAFT" ||
                              job.status === "PENDING_REVIEW") && (
                              <Link
                                href={`/organization/jobs/${job.id}/edit`}
                                className="focus-visible:outline-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                Edit
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {result.totalPages > 1 && (
            <nav
              aria-label="Jobs pagination"
              className="mt-4 flex items-center justify-center gap-2"
            >
              {result.page > 1 && (
                <Link
                  href={`/organization/jobs?page=${result.page - 1}${status ? `&status=${status}` : ""}`}
                  className="focus-visible:outline-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Previous
                </Link>
              )}
              <span className="px-3 py-1.5 text-sm text-muted">
                Page {result.page} of {result.totalPages}
              </span>
              {result.page < result.totalPages && (
                <Link
                  href={`/organization/jobs?page=${result.page + 1}${status ? `&status=${status}` : ""}`}
                  className="focus-visible:outline-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
