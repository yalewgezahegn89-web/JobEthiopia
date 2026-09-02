import Link from "next/link";
import {
  freshnessLabel,
  closingState,
  type PublicJobSummary,
} from "@/lib/jobs/public";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand-mark";

function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (
    words[0][0] + words[words.length - 1][0]
  ).toUpperCase();
}

export default function JobCard({ job }: { job: PublicJobSummary }) {
  const freshness = freshnessLabel(job.postedAt);
  const closing = closingState(job.deadline, job.status);
  const isVerified = job.verificationStatus === "VERIFIED";
  const isClosing = closing === "CLOSING";
  const isExpired = closing === "EXPIRED";

  const rail = isExpired
    ? "bg-destructive"
    : isClosing
      ? "bg-accent"
      : "bg-primary";

  return (
    <article className="h-full">
      <Link
        href={`/jobs/${job.id}`}
        className="group relative block h-full rounded-xl border border-border bg-surface pl-6 pr-5 pt-5 pb-5 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${rail}`}
        />

        <div className="flex flex-wrap items-center gap-2">
          {job.organizationName && (
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-light text-[10px] font-bold text-primary">
              {orgInitials(job.organizationName)}
            </span>
          )}
          {job.organizationName ? (
            <span className="truncate text-sm font-medium text-muted">
              {job.organizationName}
            </span>
          ) : (
            <BrandMark size={20} />
          )}
          {isVerified && (
            <Badge variant="success" className="ml-auto">
              Verified
            </Badge>
          )}
        </div>

        <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {job.title}
        </h3>

        {job.locationName && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-subtle">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            {job.locationName}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.professionName && (
            <Badge variant="default">{job.professionName}</Badge>
          )}
          {job.categoryName && <Badge variant="default">{job.categoryName}</Badge>}
          {job.employmentType && (
            <Badge variant="info">
              {job.employmentType.replace("_", " ")}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-subtle pt-3 text-xs text-muted">
          {isExpired && <Badge variant="destructive">Expired</Badge>}
          {isClosing && (
            <Badge variant="warning">
              <ClockIcon className="mr-1 h-3 w-3" />
              Closing soon
            </Badge>
          )}
          {!isExpired && !isClosing && freshness && <span>{freshness}</span>}

          {job.deadlineText && (
            <span>
              Deadline: <time>{job.deadlineText}</time>
            </span>
          )}

          {job.salaryText && (
            <span className="text-subtle">{job.salaryText}</span>
          )}
        </div>
      </Link>
    </article>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
