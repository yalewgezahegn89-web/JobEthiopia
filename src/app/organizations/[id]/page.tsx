import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchOrganizationById,
  type PublicOrganizationDetail,
} from "@/lib/organizations/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import JobCard from "@/components/job-card";
import { Breadcrumb } from "@/components/public/breadcrumb";
import {
  CheckIcon,
  BuildingIcon,
  ExternalLinkIcon,
} from "@/components/public/icons";

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
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Organization details</h1>
        <p className="mt-4 text-muted">
          We could not load this organization right now. Please try again
          shortly.
        </p>
        <Link
          href="/organizations"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
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
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Organizations", href: "/organizations" },
          { label: organization.name },
        ]}
      />

      <article className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {organization.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={organization.logoUrl}
                  alt={`${organization.name} logo`}
                  className="h-16 w-16 shrink-0 rounded-xl bg-surface-raised object-contain"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-light text-xl font-bold text-primary">
                  {organizationInitials(organization.name)}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {organization.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {organization.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-xs font-semibold text-success">
                      <CheckIcon className="h-3 w-3" />
                      Verified employer
                    </span>
                  )}
                  {organization.industry && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
                      <BuildingIcon className="h-3 w-3" />
                      {organization.industry}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {organization.websiteUrl && (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-visible:outline-2 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-raised hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Visit website
                <ExternalLinkIcon className="h-4 w-4 text-subtle" />
              </a>
            )}
          </div>

          {organization.description && (
            <p className="mt-6 max-w-3xl whitespace-pre-line text-base leading-7 text-muted">
              {organization.description}
            </p>
          )}
        </div>
      </article>

      <section aria-labelledby="open-jobs-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Open roles
            </p>
            <h2
              id="open-jobs-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Open jobs
            </h2>
          </div>
          <Link
            href={`/jobs?organizationId=${encodeURIComponent(organization.id)}`}
            className="focus-visible:outline-2 hidden shrink-0 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            Browse all jobs
          </Link>
        </div>

        {jobsLoadError ? (
          <p className="mt-4 text-muted">
            We could not load this organization&apos;s open jobs right now.
            Please try again shortly.
          </p>
        ) : openJobs.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
              <BuildingIcon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No open jobs right now
            </h3>
            <p className="mt-1 text-sm text-muted">
              This organization has no open positions at the moment.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openJobs.map((job) => (
              <li key={job.id} className="h-full">
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function organizationInitials(name: string | null | undefined): string {
  if (!name) {
    return "?";
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}