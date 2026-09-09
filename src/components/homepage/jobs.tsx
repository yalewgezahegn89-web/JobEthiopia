import Link from "next/link";
import type { PublicJobSummary } from "@/lib/jobs/public";
import { SectionHeading } from "@/components/homepage/section-heading";
import JobCard from "@/components/job-card";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function LatestJobs({ jobs, t }: { jobs: PublicJobSummary[]; t: Dictionary }) {

  return (
    <section aria-labelledby="latest-jobs-heading">
      <SectionHeading
        id="latest-jobs-heading"
        eyebrow={t.home.latestJobsEyebrow}
        title={t.home.latestJobsTitle}
        subtitle={t.home.latestJobsSubtitle}
        action={
          <Link
            href="/jobs"
            className="focus-visible:outline-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.home.viewAllJobs}
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} t={t} />
        ))}
      </div>
    </section>
  );
}

export function ClosingSoon({ jobs, t }: { jobs: PublicJobSummary[]; t: Dictionary }) {
  if (jobs.length === 0) return null;

  return (
    <section
      aria-labelledby="closing-soon-heading"
      className="rounded-2xl border border-warning/30 bg-warning-light/40 p-6 sm:p-8"
    >
      <SectionHeading
        id="closing-soon-heading"
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon />
            {t.home.closingSoonEyebrow}
          </span>
        }
        title={t.home.closingSoonTitle}
        subtitle={t.home.closingSoonSubtitle}
        action={
          <Link
            href="/jobs"
            className="focus-visible:outline-2 text-sm font-semibold text-warning hover:text-warning focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.home.viewAllJobs}
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} t={t} />
        ))}
      </div>
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-4 w-4 text-warning"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
