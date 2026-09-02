import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import {
  getOwnedApplicationDetail,
  getCandidateApplicationHistory,
  type ApplicationStatus,
} from "@/lib/applications/dal";
import { ApplicationWithdraw } from "@/components/applications/withdraw-button";
import { ResumeForm } from "@/components/applications/resume-form";
import { ApplicationStatusBadge } from "@/components/applications/status-badge";
import { ApplicationStatusProgress } from "@/components/applications/status-progress";
import { getOwnedCandidateResume } from "@/lib/resume/dal";
import { Breadcrumb } from "@/components/public/breadcrumb";
import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ArrowRightIcon,
} from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application | JobEthiopia",
  description: "Your application details on JobEthiopia.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTime(value: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function actionLabel(action: string): string {
  switch (action) {
    case "APPLICATION_SUBMITTED":
      return "Application submitted";
    case "APPLICATION_WITHDRAWN":
      return "Application withdrawn";
    case "APPLICATION_STATUS_CHANGED":
      return "Status updated";
    default:
      return action;
  }
}

function historyDetail(
  entry: { action: string; previousStatus: string | null; newStatus: string | null },
): string | null {
  if (entry.previousStatus && entry.newStatus) {
    return `${entry.previousStatus} → ${entry.newStatus}`;
  }
  if (entry.newStatus) return entry.newStatus;
  return null;
}

function actorInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function TimelineMarker({
  action,
}: {
  action: string;
}) {
  if (action === "APPLICATION_SUBMITTED") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
        <CheckIcon className="h-4 w-4" />
      </span>
    );
  }
  if (action === "APPLICATION_WITHDRAWN") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted">
        <MinusIcon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-warning">
      <RefreshIcon className="h-4 w-4" />
    </span>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) {
    redirect("/jobs");
  }

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const detail = await getOwnedApplicationDetail(id, user.id);
  if (!detail) {
    notFound();
  }

  const history = await getCandidateApplicationHistory(id);
  const resume = await getOwnedCandidateResume(id, user.id);

  const canWithdraw =
    detail.status === "SUBMITTED" || detail.status === "REVIEWING";
  const status = detail.status as ApplicationStatus;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "My Applications", href: "/applications" },
          { label: detail.jobTitle },
        ]}
      />

      <header className="mt-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-light text-lg font-bold text-primary">
                {actorInitials(detail.organizationName)}
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  Job application
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {detail.jobTitle}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <BuildingIcon className="h-4 w-4 text-subtle" />
                  {detail.organizationName ?? "Unknown organization"}
                </p>
              </div>
            </div>
            <ApplicationStatusBadge status={status} className="shrink-0 text-sm" />
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                Submitted
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
                <CalendarIcon className="h-4 w-4 text-subtle" />
                {formatDateTime(detail.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                Last updated
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
                <CalendarIcon className="h-4 w-4 text-subtle" />
                {formatDateTime(detail.updatedAt)}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <section aria-labelledby="status-heading" className="mt-6">
        <h2
          id="status-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Status
        </h2>
        <div className="mt-3">
          <ApplicationStatusProgress status={status} />
        </div>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-8">
          <h2
            id="history-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Application history
          </h2>
          <ol
            className="mt-4 space-y-0"
            aria-label="Application history"
          >
            {history.map((entry, index) => {
              const detailText = historyDetail(entry);
              const isLast = index === history.length - 1;
              return (
                <li key={`${entry.action}-${index}`} className="relative flex gap-4">
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="absolute left-4 top-8 h-full w-0.5 bg-border"
                    />
                  )}
                  <TimelineMarker action={entry.action} />
                  <div className="pb-6">
                    <p className="text-sm font-semibold text-foreground">
                      {actionLabel(entry.action)}
                    </p>
                    {detailText && (
                      <p className="mt-0.5 text-sm text-muted">{detailText}</p>
                    )}
                    <p className="mt-1 text-xs text-subtle">
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {detail.coverLetter && (
        <section aria-labelledby="cover-letter-heading" className="mt-8">
          <h2
            id="cover-letter-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Cover letter
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
            <p className="whitespace-pre-line text-sm leading-7 text-foreground">
              {detail.coverLetter}
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="resume-heading" className="mt-8">
        <h2
          id="resume-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Resume
        </h2>
        <div className="mt-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
          <ResumeForm
            applicationId={detail.id}
            current={
              resume
                ? {
                    originalName: resume.originalName,
                    size: resume.size,
                    updatedAt: resume.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </div>
      </section>

      <section
        aria-labelledby="application-actions-heading"
        className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6"
      >
        <h2 id="application-actions-heading" className="sr-only">
          Application actions
        </h2>
        <Link
          href={`/jobs/${detail.jobId}`}
          className="focus-visible:outline-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View job
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
        {canWithdraw && <ApplicationWithdraw applicationId={detail.id} />}
      </section>
    </div>
  );
}