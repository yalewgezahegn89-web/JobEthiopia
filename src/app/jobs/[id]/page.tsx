import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJobById, fetchJobs, formatDate, freshnessLabel, closingState, type PublicJobDetail, type PublicJobSummary } from "@/lib/jobs/public";
import { selectRelatedJobs } from "@/lib/jobs/related";
import { getCurrentUser } from "@/lib/auth/context";
import JobShare from "@/components/job-share";
import { ApplyButton } from "@/components/applications/apply-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job | JobEthiopia",
  description: "Job details on JobEthiopia.",
};

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
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Job details</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load this job right now. Please try again shortly.
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Back to Jobs
        </Link>
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  const employmentType = formatEmploymentType(job.employmentType);
  const experience = experienceText(job.experienceMin, job.experienceMax);
  const postedText = formatDate(job.postedAt);
  const freshness = freshnessLabel(job.postedAt);
  const verifiedFreshness = freshnessLabel(job.lastVerifiedAt);
  const closing = closingState(job.deadline, job.status);

  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    currentUser = null;
  }

  const canApplyInternally =
    currentUser?.role === "CANDIDATE" &&
    closing !== "EXPIRED" &&
    job.applicationUrl === null;

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/jobs"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Jobs
      </Link>

      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
          <p className="mt-2 text-gray-700 dark:text-gray-200">
            {job.organizationName ?? "Unknown organization"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
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
            {employmentType && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                {employmentType}
              </span>
            )}
            {experience && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                {experience}
              </span>
            )}
            {postedText && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                Posted {postedText}
              </span>
            )}
            {freshness && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                {freshness}
              </span>
            )}
            {job.verificationStatus === "VERIFIED" && (
              <span className="rounded-md bg-green-100 px-2 py-1 font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                Verified
              </span>
            )}
            {verifiedFreshness && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                Verified {verifiedFreshness}
              </span>
            )}
            {closing === "CLOSING" && (
              <span className="rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                Closing soon
              </span>
            )}
            {closing === "EXPIRED" && (
              <span className="rounded-md bg-red-100 px-2 py-1 font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
                Expired
              </span>
            )}
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {job.salaryText && (
              <div className="flex justify-between gap-4 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                <dt className="text-gray-500 dark:text-gray-400">Salary</dt>
                <dd className="font-semibold">{job.salaryText}</dd>
              </div>
            )}
            {job.deadlineText && (
              <div className="flex justify-between gap-4 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                <dt className="text-gray-500 dark:text-gray-400">Deadline</dt>
                <dd className="font-semibold">{job.deadlineText}</dd>
              </div>
            )}
          </dl>

          {job.applicationUrl && (
            <div className="mt-4 rounded-md border border-gray-200 p-4 text-center dark:border-gray-800">
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-6 py-3 text-base font-semibold text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 sm:w-auto"
              >
                Apply Now
              </a>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Opens an external application page.
              </p>
            </div>
          )}

          {canApplyInternally && (
            <ApplyButton jobId={job.id} jobTitle={job.title} />
          )}

          <div className="mt-4">
            <JobShare title={job.title} />
          </div>
        </header>

        <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700 dark:text-gray-200">
          {job.description && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {sentenceCase(job.description)}
              </p>
            </section>
          )}

          {job.responsibilities && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Responsibilities
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {sentenceCase(job.responsibilities)}
              </p>
            </section>
          )}

          {job.requirements && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Requirements
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {sentenceCase(job.requirements)}
              </p>
            </section>
          )}

          {job.educationRequirements && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Education
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {sentenceCase(job.educationRequirements)}
              </p>
            </section>
          )}

          {job.benefits && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Benefits
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {sentenceCase(job.benefits)}
              </p>
            </section>
          )}
        </div>
      </article>

      {relatedItems.length > 0 && (
        <section className="mt-10" aria-labelledby="related-jobs-heading">
          <h2
            id="related-jobs-heading"
            className="text-xl font-bold tracking-tight"
          >
            Related jobs
          </h2>
          <ul className="mt-4 space-y-3">
            {relatedItems.map((relatedJob) => {
              const relatedEmployment = formatEmploymentType(
                relatedJob.employmentType,
              );
              const relatedFreshness = freshnessLabel(relatedJob.postedAt);
              const relatedClosing = closingState(
                relatedJob.deadline,
                relatedJob.status,
              );

              return (
                <li key={relatedJob.id}>
                  <Link
                    href={`/jobs/${relatedJob.id}`}
                    className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:hover:bg-gray-900"
                  >
                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                      {relatedJob.title}
                    </span>
                    {relatedJob.organizationName && (
                      <span className="mt-1 block text-sm text-gray-700 dark:text-gray-200">
                        {relatedJob.organizationName}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                      {relatedJob.locationName && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                          {relatedJob.locationName}
                        </span>
                      )}
                      {relatedEmployment && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                          {relatedEmployment}
                        </span>
                      )}
                      {relatedJob.salaryText && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                          {relatedJob.salaryText}
                        </span>
                      )}
                      {relatedFreshness && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                          {relatedFreshness}
                        </span>
                      )}
                      {relatedClosing === "CLOSING" && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Closing soon
                        </span>
                      )}
                      {relatedClosing === "EXPIRED" && (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
                          Expired
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}