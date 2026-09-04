import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchJobById,
  fetchJobs,
  formatDate,
  freshnessLabel,
  closingState,
  type PublicJobDetail,
  type PublicJobSummary,
} from "@/lib/jobs/public";
import { selectRelatedJobs } from "@/lib/jobs/related";
import { getCurrentUser } from "@/lib/auth/context";
import { isJobSaved } from "@/lib/savedJobs/dal";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { Breadcrumb } from "@/components/public/breadcrumb";
import JobShare from "@/components/job-share";
import { ApplyButton } from "@/components/applications/apply-button";
import { SaveButton } from "@/components/saved-jobs/save-button";
import JobCard from "@/components/job-card";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand-mark";

export const dynamic = "force-dynamic";

function truncateMetadata(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3).trimEnd() + "...";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  let job: PublicJobDetail | null = null;
  try {
    job = await fetchJobById(id);
  } catch {
    // fall through to fallback metadata
  }

  if (!job) {
    return {
      title: "Job | JobEthiopia",
      description: "Job details on JobEthiopia.",
    };
  }

  const title = job.title;
  const org = job.organizationName ?? "";
  const description = job.description
    ? truncateMetadata(job.description, 160)
    : `${title}${org ? ` at ${org}` : ""} — find verified jobs on JobEthiopia.`;

  const baseUrl = getAppBaseUrl();
  const canonicalUrl = `${baseUrl}/jobs/${id}`;

  const openGraph = {
    title: `${title} | JobEthiopia`,
    description,
    url: canonicalUrl,
    type: "article" as const,
    siteName: "JobEthiopia",
  };

  const twitter = {
    card: "summary_large_image" as const,
    title: `${title} | JobEthiopia`,
    description,
  };

  return {
    title,
    description,
    openGraph,
    twitter,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

function formatEmploymentType(value: string | null): string | null {
  return value ? value.replace("_", " ") : null;
}

function sentenceCase(value: string | null): string | null {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : null;
}

function experienceText(
  min: number | null,
  max: number | null,
): string | null {
  if (min == null && max == null) {
    return null;
  }
  if (min != null && max != null) {
    return min === max ? `${min} years` : `${min} - ${max} years`;
  }
  if (min != null) {
    return `${min}+ years`;
  }
  return `Up to ${max} years`;
}

function orgInitials(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

function buildJobPostingLd(
  job: PublicJobDetail,
): Record<string, unknown> | null {
  if (
    !job.title ||
    !job.description ||
    !job.postedAt ||
    !job.deadline ||
    !job.locationName ||
    !job.employmentType ||
    !job.organizationName
  ) {
    return null;
  }

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.postedAt,
    validThrough: job.deadline,
    employmentType: job.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: job.organizationName,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.locationName,
      },
    },
  };

  return ld;
}

function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let job: PublicJobDetail | null = null;
  let loadError = false;

  try {
    job = await fetchJobById(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-12">
        <ErrorState
          heading="We could not load this job"
          body="Something went wrong while loading this job. Please try again shortly."
          ctaHref="/jobs"
          ctaLabel="Back to Jobs"
        />
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  const employmentType = formatEmploymentType(job.employmentType);
  const experience = experienceText(job.experienceMin, job.experienceMax);
  const freshness = freshnessLabel(job.postedAt);
  const verifiedFreshness = freshnessLabel(job.lastVerifiedAt);
  const closing = closingState(job.deadline, job.status);
  const isExternal = Boolean(job.applicationUrl);

  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    currentUser = null;
  }

  const showInternalApply =
    currentUser?.role === "CANDIDATE" &&
    closing !== "EXPIRED" &&
    job.applicationUrl === null;

  const showExternalApply = isExternal && closing !== "EXPIRED";

  const canSaveJob =
    currentUser?.role === "CANDIDATE" && job.status === "PUBLISHED";
  let initialSaved = false;
  if (canSaveJob && currentUser) {
    try {
      initialSaved = await isJobSaved(currentUser.id, job.id);
    } catch {
      initialSaved = false;
    }
  }

  let relatedItems: PublicJobSummary[] = [];
  try {
    const relatedResult = await fetchJobs({
      page: 1,
      limit: 8,
      status: "PUBLISHED",
    });
    relatedItems = selectRelatedJobs(
      relatedResult.items,
      job.id,
      {
        category: job.categoryName ?? null,
        profession: job.professionName ?? null,
      },
      3,
    );
  } catch {
    relatedItems = [];
  }

  const jsonLd = buildJobPostingLd(job);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Jobs", href: "/jobs" },
          { label: job.title },
        ]}
      />

      <article className="mt-5">
        <JobHeader
          job={job}
          employmentType={employmentType}
          experience={experience}
          freshness={freshness}
          verifiedFreshness={verifiedFreshness}
          closing={closing}
        />

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <main className="space-y-8">
              <ContentSections job={job} />
              <SourceSection job={job} closing={closing} />
            </main>
          </div>

          <aside
            aria-label="Job overview"
            className="min-w-0 lg:sticky lg:top-6 lg:self-start"
          >
            <div className="space-y-4">
              <section
                aria-label="Apply and save"
                className="rounded-xl border border-border bg-surface p-5"
              >
                <DeadlineNote
                  closing={closing}
                  deadlineText={job.deadlineText}
                />

                {showInternalApply && (
                  <div className="mt-4">
                    <ApplyButton jobId={job.id} jobTitle={job.title} />
                  </div>
                )}

                {showExternalApply && (
                  <div className="mt-4">
                    <a
                      href={job.applicationUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-visible:outline-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Apply on employer site
                      <ExternalIcon className="h-4 w-4" />
                    </a>
                    <p className="mt-2 text-xs text-muted">
                      Opens an external application page in a new tab.
                    </p>
                  </div>
                )}

                {closing === "EXPIRED" && (
                  <p className="mt-4 text-sm font-medium text-destructive">
                    This job has closed and is no longer accepting
                    applications.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <JobShare title={job.title} />
                  {canSaveJob && (
                    <div className="inline-flex">
                      <SaveButton
                        jobId={job.id}
                        initialSaved={initialSaved}
                      />
                    </div>
                  )}
                </div>
              </section>

              <KeyFacts job={job} closing={closing} />
            </div>
          </aside>
        </div>
      </article>

      {relatedItems.length > 0 && (
        <section className="mt-12" aria-labelledby="related-jobs-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                Keep exploring
              </p>
              <h2
                id="related-jobs-heading"
                className="text-xl font-semibold tracking-tight"
              >
                More opportunities
              </h2>
            </div>
            <Link
              href="/jobs"
              className="focus-visible:outline-2 hidden shrink-0 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
            >
              View all jobs
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedItems.map((relatedJob) => (
              <li key={relatedJob.id} className="h-full">
                <JobCard job={relatedJob} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
    </div>
  );
}

function JobHeader({
  job,
  employmentType,
  experience,
  freshness,
  verifiedFreshness,
  closing,
}: {
  job: PublicJobDetail;
  employmentType: string | null;
  experience: string | null;
  freshness: string | null;
  verifiedFreshness: string | null;
  closing: "OPEN" | "CLOSING" | "EXPIRED" | null;
}) {
  const initials = orgInitials(job.organizationName);
  const verified = job.verificationStatus === "VERIFIED";

  return (
    <header className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {initials ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-light text-xl font-bold text-primary">
              {initials}
            </span>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
              <BrandMark size={32} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-muted">
              {job.organizationName ?? "JobEthiopia"}
            </p>
            {verified && <Badge variant="success">Verified</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineBadge closing={closing} deadlineText={job.deadlineText} />
          {freshness && <Badge variant="default">{freshness}</Badge>}
        </div>
      </div>

      <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {job.title}
      </h1>

      {(job.locationName || employmentType || job.professionName) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {job.locationName && (
            <Badge variant="info">
              <PinIcon className="h-3.5 w-3.5" />
              {job.locationName}
            </Badge>
          )}
          {employmentType && <Badge variant="default">{employmentType}</Badge>}
          {job.professionName && (
            <Badge variant="default">{job.professionName}</Badge>
          )}
          {job.categoryName && (
            <Badge variant="default">{job.categoryName}</Badge>
          )}
          {experience && <Badge variant="default">{experience}</Badge>}
        </div>
      )}

      {verifiedFreshness && (
        <p className="mt-4 text-xs text-subtle">
          Verified {verifiedFreshness}
        </p>
      )}
    </header>
  );
}

function KeyFacts({
  job,
  closing,
}: {
  job: PublicJobDetail;
  closing: "OPEN" | "CLOSING" | "EXPIRED" | null;
}) {
  const experience = experienceText(job.experienceMin, job.experienceMax);
  return (
    <section
      aria-label="Key facts"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="text-base font-semibold tracking-tight">Key facts</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <Fact
          label="Deadline"
          value={job.deadlineText ?? "Rolling"}
          emphasise={closing === "CLOSING" || closing === "EXPIRED"}
          closing={closing}
        />
        {job.salaryText && <Fact label="Salary" value={job.salaryText} />}
        {job.locationName && <Fact label="Location" value={job.locationName} />}
        {employmentTypeDisplay(job.employmentType) && (
          <Fact
            label="Employment type"
            value={employmentTypeDisplay(job.employmentType)!}
          />
        )}
        {job.categoryName && <Fact label="Category" value={job.categoryName} />}
        {job.professionName && (
          <Fact label="Profession" value={job.professionName} />
        )}
        {experience && <Fact label="Experience" value={experience} />}
        {formatDate(job.postedAt) && (
          <Fact label="Posted" value={formatDate(job.postedAt)!} />
        )}
      </dl>
    </section>
  );
}

function employmentTypeDisplay(value: string | null): string | null {
  return value ? value.replace("_", " ") : null;
}

function Fact({
  label,
  value,
  emphasise,
  closing,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  closing?: "OPEN" | "CLOSING" | "EXPIRED" | null;
}) {
  const valueClass =
    closing === "EXPIRED"
      ? "text-destructive"
      : closing === "CLOSING"
        ? "text-warning"
        : emphasise
          ? "font-semibold text-foreground"
          : "text-foreground";
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-right font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
}

function DeadlineBadge({
  closing,
  deadlineText,
}: {
  closing: "OPEN" | "CLOSING" | "EXPIRED" | null;
  deadlineText: string | null;
}) {
  if (closing === "EXPIRED") {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (closing === "CLOSING") {
    return (
      <Badge variant="warning">
        <ClockIcon className="h-3.5 w-3.5" />
        Closing soon
      </Badge>
    );
  }
  if (closing === "OPEN" && deadlineText) {
    return <Badge variant="success">Open</Badge>;
  }
  return null;
}

function DeadlineNote({
  closing,
  deadlineText,
}: {
  closing: "OPEN" | "CLOSING" | "EXPIRED" | null;
  deadlineText: string | null;
}) {
  if (!deadlineText && closing !== "EXPIRED" && closing !== "CLOSING") {
    return null;
  }
  if (closing === "EXPIRED") {
    return (
      <p className="text-sm font-semibold text-destructive">
        Deadline: {deadlineText ?? "Past"}
      </p>
    );
  }
  if (closing === "CLOSING") {
    return (
      <p className="text-sm font-semibold text-warning">
        Deadline: {deadlineText}
      </p>
    );
  }
  return <p className="text-sm font-medium text-muted">Deadline: {deadlineText}</p>;
}

function ContentSections({ job }: { job: PublicJobDetail }) {
  return (
    <>
      {job.description && (
        <section>
          <SectionHeading>About the role</SectionHeading>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground">
            {sentenceCase(job.description)}
          </p>
        </section>
      )}

      {job.responsibilities && (
        <section>
          <SectionHeading>Responsibilities</SectionHeading>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground">
            {sentenceCase(job.responsibilities)}
          </p>
        </section>
      )}

      {job.requirements && (
        <section>
          <SectionHeading>Requirements</SectionHeading>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground">
            {sentenceCase(job.requirements)}
          </p>
        </section>
      )}

      {job.educationRequirements && (
        <section>
          <SectionHeading>Qualifications</SectionHeading>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground">
            {sentenceCase(job.educationRequirements)}
          </p>
        </section>
      )}

      {job.benefits && (
        <section>
          <SectionHeading>Benefits</SectionHeading>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground">
            {sentenceCase(job.benefits)}
          </p>
        </section>
      )}
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border-subtle pb-1 text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function SourceSection({
  job,
  closing,
}: {
  job: PublicJobDetail;
  closing: "OPEN" | "CLOSING" | "EXPIRED" | null;
}) {
  const verified = job.verificationStatus === "VERIFIED";
  if (job.applicationUrl) {
    return (
      <section
        aria-label="How to apply"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2 className="text-base font-semibold tracking-tight">How to apply</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          This role is managed through an external application. Use the{" "}
          <a
            href={job.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2"
          >
            Apply on employer site
          </a>{" "}
          button to continue on the hiring organization&apos;s page.
        </p>
      </section>
    );
  }

  if (verified || (closing === "OPEN" && job.deadlineText)) {
    return (
      <section
        aria-label="Trust and application"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2 className="text-base font-semibold tracking-tight">
          About this application
        </h2>
        <dl className="mt-3 space-y-2 text-sm text-muted">
          {verified && (
            <div className="flex items-center gap-2">
              <Badge variant="success">Verified</Badge>
              <span>This listing has been verified.</span>
            </div>
          )}
          {closing === "OPEN" && job.deadlineText && (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-subtle" />
              <span>Apply before {job.deadlineText}.</span>
            </div>
          )}
        </dl>
      </section>
    );
  }

  return null;
}

function ErrorState({
  heading,
  body,
  ctaHref,
  ctaLabel,
}: {
  heading: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">{heading}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      <Link
        href={ctaHref}
        className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

function PinIcon({ className }: { className?: string }) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
