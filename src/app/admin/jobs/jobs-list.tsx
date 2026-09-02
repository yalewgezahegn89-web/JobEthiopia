import Link from "next/link";
import type { ModerationJobPaginated } from "@/lib/admin/jobs";

const STATUSES = ["PENDING_REVIEW", "PUBLISHED", "DRAFT", "EXPIRED", "REMOVED"];
const VERIFICATION = ["PENDING", "VERIFIED", "NEEDS_REVIEW", "INVALID"];

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function statusBadge(status: string) {
  if (status === "PUBLISHED" || status === "VERIFIED") {
    return "bg-success-light text-success";
  }
  if (status === "PENDING_REVIEW" || status === "NEEDS_REVIEW" || status === "PENDING") {
    return "bg-warning-light text-warning";
  }
  if (status === "REMOVED" || status === "INVALID") {
    return "bg-destructive-light text-destructive";
  }
  return "bg-surface-raised border border-border-subtle text-muted";
}

export default function JobsList({
  result,
  currentStatus,
  currentVerification,
}: {
  result: ModerationJobPaginated;
  currentStatus?: string;
  currentVerification?: string;
}) {
  return (
    <div className="mt-6 space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            name="status"
            className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground ${FOCUS_RING}`}
          >
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} selected={currentStatus === s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Verification</span>
          <select
            name="verificationStatus"
            className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground ${FOCUS_RING}`}
          >
            <option value="">Any</option>
            {VERIFICATION.map((v) => (
              <option key={v} value={v} selected={currentVerification === v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className={`rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md ${FOCUS_RING}`}
        >
          Filter
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-muted">The moderation queue is empty.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised text-left">
                  <th className="px-4 py-3 font-semibold text-foreground">Job</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Verification</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Posted</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className={`font-semibold text-foreground hover:text-primary ${FOCUS_RING}`}
                      >
                        {job.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">
                        {[job.organizationName, job.categoryName, job.professionName, job.locationName]
                          .filter(Boolean)
                          .join(" · ") || "No organization"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(job.verificationStatus)}`}
                      >
                        {job.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-subtle">
                      {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "n/a"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Moderation queue pagination">
          <span className="text-muted">
            Page {result.page} of {result.totalPages} ({result.total} jobs)
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={`/admin/jobs?page=${result.page - 1}`}
                className={`rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-foreground shadow-sm hover:bg-surface-raised hover:shadow-md ${FOCUS_RING}`}
              >
                Previous
              </Link>
            )}
            {result.page < result.totalPages && (
              <Link
                href={`/admin/jobs?page=${result.page + 1}`}
                className={`rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-foreground shadow-sm hover:bg-surface-raised hover:shadow-md ${FOCUS_RING}`}
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
