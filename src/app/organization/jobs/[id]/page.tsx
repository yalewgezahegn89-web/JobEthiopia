import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { getEmployerJob } from "@/lib/employer/jobs";
import { JobStatusControls } from "./status-controls";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/public/breadcrumb";
import {
  BriefcaseIcon,
  BuildingIcon,
  EditIcon,
  PinIcon,
  CalendarIcon,
} from "@/components/public/icons";

export const dynamic = "force-dynamic";

const JOB_STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  DRAFT: { label: "Draft", variant: "default" },
  PENDING_REVIEW: { label: "Pending review", variant: "warning" },
  PUBLISHED: { label: "Published", variant: "success" },
  EXPIRED: { label: "Expired", variant: "destructive" },
  REMOVED: { label: "Removed", variant: "destructive" },
};

function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })} · ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function TextSection({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  if (!value || !value.trim()) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
        {value}
      </p>
    </section>
  );
}

export default async function EmployerJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) redirect("/login");

  const user = await verifySession(rawToken);
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const { id } = await params;

  let job;
  try {
    job = await getEmployerJob(user.id, id);
  } catch {
    notFound();
  }

  if (!job) notFound();

  const isEditable = job.status === "DRAFT" || job.status === "PENDING_REVIEW";
  const meta = JOB_STATUS_META[job.status] ?? {
    label: job.status.replace("_", " "),
    variant: "default" as const,
  };

  const metadata: { label: string; value: string | null; icon?: React.ReactNode }[] = [
    { label: "Organization", value: job.organizationName, icon: <BuildingIcon className="h-4 w-4" /> },
    { label: "Category", value: job.categoryName ?? null },
    { label: "Profession", value: job.professionName ?? null },
    { label: "Location", value: job.locationName ?? null, icon: <PinIcon className="h-4 w-4" /> },
    {
      label: "Employment type",
      value: job.employmentType
        ? job.employmentType
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ")
        : null,
    },
    {
      label: "Experience",
      value:
        job.experienceMin != null
          ? `${job.experienceMin}${job.experienceMax != null ? ` - ${job.experienceMax}` : ""} years`
          : null,
    },
    {
      label: "Salary",
      value:
        job.salaryMin != null
          ? `${job.salaryMin}${job.salaryMax != null ? ` - ${job.salaryMax}` : ""}${job.salaryCurrency ? ` ${job.salaryCurrency}` : ""}${job.salaryPeriod ? ` / ${job.salaryPeriod.toLowerCase()}` : ""}`
          : null,
    },
    { label: "Deadline", value: job.deadline ? formatDate(job.deadline) : null, icon: <CalendarIcon className="h-4 w-4" /> },
    { label: "Posted", value: job.postedAt ? formatDate(job.postedAt) : null },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Home", href: "/organization" },
          { label: "Jobs", href: "/organization/jobs" },
          { label: job.title },
        ]}
      />

      <header className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <BriefcaseIcon className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="mb-1 flex items-center gap-1.5 text-sm text-muted">
                  <BuildingIcon className="h-4 w-4 text-subtle" />
                  {job.organizationName}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {job.title}
                </h1>
              </div>
            </div>
            <Badge variant={meta.variant} className="shrink-0 text-sm">
              {meta.label}
            </Badge>
          </div>

          {!isEditable && job.status !== "REMOVED" && (
            <p className="mt-4 rounded-lg bg-accent-light px-4 py-3 text-sm text-warning">
              Published jobs cannot be edited by employers. Contact staff to
              request changes.
            </p>
          )}
          {job.status === "REMOVED" && (
            <p className="mt-4 rounded-lg bg-destructive-light px-4 py-3 text-sm text-destructive">
              This job has been removed.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <JobStatusControls jobId={job.id} status={job.status as "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED"} />
            {isEditable && (
              <Link
                href={`/organization/jobs/${job.id}/edit`}
                className="focus-visible:outline-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <EditIcon className="h-4 w-4" />
                Edit Job
              </Link>
            )}
          </div>
        </div>
      </header>

      <section
        aria-labelledby="overview-heading"
        className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm"
      >
        <h2
          id="overview-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Overview
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {metadata
            .filter((m) => m.value)
            .map((m) => (
              <div key={m.label}>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-subtle">
                  {m.icon}
                  {m.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {m.value}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      <div className="mt-6 space-y-6">
        <TextSection title="Description" value={job.description} />
        <TextSection title="Responsibilities" value={job.responsibilities} />
        <TextSection title="Requirements" value={job.requirements} />
        <TextSection
          title="Education requirements"
          value={job.educationRequirements}
        />
        <TextSection title="Benefits" value={job.benefits} />

        {job.applicationUrl && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">
              Application URL
            </h2>
            <a
              href={job.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-visible:outline-2 mt-2 inline-block text-sm font-medium text-primary focus-visible:outline-offset-2 focus-visible:outline-primary hover:underline"
            >
              {job.applicationUrl}
            </a>
          </section>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-2 border-t border-border py-4 text-xs text-subtle sm:grid-cols-2">
        <div>Created: {formatDateTime(job.createdAt as Date)}</div>
        <div>Updated: {formatDateTime(job.updatedAt as Date)}</div>
      </div>
    </div>
  );
}
