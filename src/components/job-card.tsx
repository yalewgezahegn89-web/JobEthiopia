import Link from "next/link";
import type { PublicJobSummary } from "@/lib/jobs/public";

export default function JobCard({ job }: { job: PublicJobSummary }) {
  return (
    <article>
      <Link
        href={`/jobs/${job.id}`}
        className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:hover:bg-gray-900"
      >
        <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
          {job.title}
        </h3>
        {job.organizationName && (
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
            {job.organizationName}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
          {job.locationName && (
            <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {job.locationName}
            </span>
          )}
          {job.categoryName && (
            <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {job.categoryName}
            </span>
          )}
          {job.professionName && (
            <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {job.professionName}
            </span>
          )}
          {job.employmentType && (
            <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {job.employmentType.replace("_", " ")}
            </span>
          )}
        </div>
        {(job.salaryText || job.deadlineText) && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {job.salaryText && <span>{job.salaryText}</span>}
            {job.salaryText && job.deadlineText && (
              <span className="mx-1">·</span>
            )}
            {job.deadlineText && (
              <span>
                Deadline: <time>{job.deadlineText}</time>
              </span>
            )}
          </div>
        )}
      </Link>
    </article>
  );
}