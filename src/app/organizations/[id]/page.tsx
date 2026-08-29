import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchOrganizationById,
  type PublicOrganizationDetail,
} from "@/lib/organizations/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import JobCard from "@/components/job-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organization | JobEthiopia",
  description: "Organization profile and open jobs on JobEthiopia.",
};

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let organization: PublicOrganizationDetail | null = null;
  let loadError = false;

  try {
    organization = await fetchOrganizationById(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Organization details</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load this organization right now. Please try again
          shortly.
        </p>
        <Link
          href="/organizations"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Back to Organizations
        </Link>
      </div>
    );
  }

  if (!organization) {
    notFound();
  }

  let openJobs: PublicJobSummary[] = [];
  let jobsLoadError = false;
  try {
    const jobsResult = await fetchJobs({
      page: 1,
      limit: 8,
      status: "PUBLISHED",
      organizationId: organization.id,
    });
    openJobs = jobsResult.items ?? [];
  } catch {
    jobsLoadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/organizations"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Organizations
      </Link>

      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {organization.name}
          </h1>
          {organization.isVerified && (
            <span className="mt-2 inline-block rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
              Verified employer
            </span>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
            {organization.industry && (
              <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                {organization.industry}
              </span>
            )}
          </div>
        </header>

        <div className="mt-4 flex items-start gap-4">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={`${organization.name} logo`}
              className="h-16 w-16 shrink-0 rounded-md object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xl font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {organization.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0">
            {organization.websiteUrl && (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
              >
                Visit website
              </a>
            )}
            {organization.description && (
              <p className="mt-2 text-gray-700 dark:text-gray-200">
                {organization.description}
              </p>
            )}
          </div>
        </div>
      </article>

      <section aria-labelledby="open-jobs-heading" className="mt-10">
        <h2
          id="open-jobs-heading"
          className="text-xl font-bold tracking-tight"
        >
          Open jobs
        </h2>

        {jobsLoadError ? (
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            We could not load this organization&apos;s open jobs right now.
            Please try again shortly.
          </p>
        ) : openJobs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <h3 className="text-lg font-semibold">No open jobs right now</h3>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              This organization has no open positions at the moment.
            </p>
            <Link
              href="/jobs"
              className="mt-4 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
            >
              Browse all jobs
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {openJobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
