import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchLocationById,
  type PublicLocationDetail,
} from "@/lib/locations/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import JobCard from "@/components/job-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Location | JobEthiopia",
  description: "Browse jobs in this location on JobEthiopia.",
};

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
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Location details</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load this location right now. Please try again shortly.
        </p>
        <Link
          href="/locations"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/locations"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Locations
      </Link>

      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {location.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {location.type.replace("_", " ")}
            </span>
          </div>
        </header>

        {parent && (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">
            Part of{" "}
            <Link
              href={`/locations/${parent.id}`}
              className="font-semibold text-blue-600 underline hover:text-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-400"
            >
              {parent.name}
            </Link>
          </p>
        )}

        {hasCoordinates && (
          <dl className="mt-4 grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-600 dark:text-gray-300">Latitude</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-50">
                {location.latitude}
              </dd>
            </div>
            <div>
              <dt className="text-gray-600 dark:text-gray-300">Longitude</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-50">
                {location.longitude}
              </dd>
            </div>
          </dl>
        )}

        <Link
          href={`/jobs?locationId=${encodeURIComponent(location.id)}`}
          className="mt-5 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Browse jobs in this location
        </Link>
      </article>

      <section aria-labelledby="location-jobs-heading" className="mt-10">
        <h2
          id="location-jobs-heading"
          className="text-xl font-bold tracking-tight"
        >
          Jobs in {location.name}
        </h2>

        {jobsLoadError ? (
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            We could not load jobs in this location right now. Please try again
            shortly.
          </p>
        ) : locationJobs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <h3 className="text-lg font-semibold">
              No open jobs in this location.
            </h3>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              There are no published jobs in this location at the moment.
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
            {locationJobs.map((job) => (
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
