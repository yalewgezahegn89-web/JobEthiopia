import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchLocationById,
  type PublicLocationDetail,
} from "@/lib/locations/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import JobCard from "@/components/job-card";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { PinIcon } from "@/components/public/icons";

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

  let location: PublicLocationDetail | null = null;
  try {
    location = await fetchLocationById(id);
  } catch {
    // fall through to fallback metadata
  }

  if (!location) {
    return {
      title: "Location | JobEthiopia",
      description: "Browse jobs in this location on JobEthiopia.",
    };
  }

  const name = location.name;
  const typeLabel = location.type.replace("_", " ").toLowerCase();
  const description = `${name} — explore ${typeLabel} jobs on JobEthiopia.`;

  const baseUrl = getAppBaseUrl();
  const canonicalUrl = `${baseUrl}/locations/${id}`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} | JobEthiopia`,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "JobEthiopia",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | JobEthiopia`,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let location: PublicLocationDetail | null = null;
  let loadError = false;

  try {
    location = await fetchLocationById(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Location details</h1>
        <p className="mt-4 text-muted">
          We could not load this location right now. Please try again shortly.
        </p>
        <Link
          href="/locations"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to Locations
        </Link>
      </div>
    );
  }

  if (!location) {
    notFound();
  }

  let parent: { id: string; name: string } | null = null;
  if (location.parentId) {
    try {
      const parentLocation = await fetchLocationById(location.parentId);
      if (parentLocation) {
        parent = { id: parentLocation.id, name: parentLocation.name };
      }
    } catch {
      parent = null;
    }
  }

  let locationJobs: PublicJobSummary[] = [];
  let jobsLoadError = false;
  try {
    const jobsResult = await fetchJobs({
      page: 1,
      limit: 8,
      status: "PUBLISHED",
      locationId: location.id,
    });
    locationJobs = jobsResult.items ?? [];
  } catch {
    jobsLoadError = true;
  }

  const hasCoordinates =
    location.latitude != null && location.longitude != null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Locations", href: "/locations" },
          { label: location.name },
        ]}
      />

      <header className="mt-4 flex flex-wrap items-start gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <PinIcon className="h-8 w-8" />
        </span>
        <div className="min-w-0 max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
            {location.type.replace("_", " ")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {location.name}
          </h1>
          {parent && (
            <p className="mt-2 text-sm text-muted">
              Part of{" "}
              <Link
                href={`/locations/${parent.id}`}
                className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2"
              >
                {parent.name}
              </Link>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/jobs?locationId=${encodeURIComponent(location.id)}`}
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Browse all jobs in this location
            </Link>
          </div>
        </div>
      </header>

      {hasCoordinates && (
        <dl className="mt-6 inline-flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border bg-surface px-5 py-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
              Latitude
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {Number(location.latitude).toFixed(4)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
              Longitude
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {Number(location.longitude).toFixed(4)}
            </dd>
          </div>
        </dl>
      )}

      <section aria-labelledby="location-jobs-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Openings nearby
            </p>
            <h2
              id="location-jobs-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Jobs in {location.name}
            </h2>
          </div>
          <Link
            href={`/jobs?locationId=${encodeURIComponent(location.id)}`}
            className="focus-visible:outline-2 hidden shrink-0 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            View all jobs
          </Link>
        </div>

        {jobsLoadError ? (
          <p className="mt-4 text-muted">
            We could not load jobs in this location right now. Please try again
            shortly.
          </p>
        ) : locationJobs.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
              <PinIcon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No open jobs in this location
            </h3>
            <p className="mt-1 text-sm text-muted">
              There are no published jobs in this location at the moment.
            </p>
            <Link
              href="/jobs"
              className="focus-visible:outline-2 mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Browse all jobs
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locationJobs.map((job) => (
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