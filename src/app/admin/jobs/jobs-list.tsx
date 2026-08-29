import Link from "next/link";
import type { ModerationJobPaginated } from "@/lib/admin/jobs";

const STATUSES = ["PENDING_REVIEW", "PUBLISHED", "DRAFT", "EXPIRED", "REMOVED"];
const VERIFICATION = ["PENDING", "VERIFIED", "NEEDS_REVIEW", "INVALID"];

function badgeClass(status: string) {
  if (status === "PENDING_REVIEW" || status === "NEEDS_REVIEW") {
    return "bg-amber-100 text-amber-800";
  }
  if (status === "REMOVED" || status === "INVALID") {
    return "bg-red-100 text-red-800";
  }
  if (status === "VERIFIED") return "bg-green-100 text-green-800";
  return "bg-neutral-100 text-neutral-700";
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
    <div className="mt-4 space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" className="rounded-md border border-neutral-300 px-2 py-1">
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} selected={currentStatus === s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Verification
          <select name="verificationStatus" className="rounded-md border border-neutral-300 px-2 py-1">
            <option value="">Any</option>
            {VERIFICATION.map((v) => (
              <option key={v} value={v} selected={currentVerification === v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1 text-sm">
          Filter
        </button>
      </form>

      {result.items.length === 0 ? (
        <p className="text-neutral-600">The moderation queue is empty.</p>
      ) : (
        <ul className="space-y-3">
          {result.items.map((job) => (
            <li key={job.id}>
              <Link
                href={`/admin/jobs/${job.id}`}
                className="block rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-neutral-900">{job.title}</span>
                  <span className="flex flex-wrap gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${badgeClass(job.status)}`}>
                      {job.status}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${badgeClass(job.verificationStatus)}`}>
                      {job.verificationStatus}
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  {[job.organizationName, job.categoryName, job.professionName, job.locationName]
                    .filter(Boolean)
                    .join(" · ") || "No organization"}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Posted {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "n/a"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">
            Page {result.page} of {result.totalPages} ({result.total} jobs)
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={`/admin/jobs?page=${result.page - 1}`}
                className="rounded-md border border-neutral-300 px-3 py-1"
              >
                Previous
              </Link>
            )}
            {result.page < result.totalPages && (
              <Link
                href={`/admin/jobs?page=${result.page + 1}`}
                className="rounded-md border border-neutral-300 px-3 py-1"
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
