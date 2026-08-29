import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchProfessionById,
  type PublicProfessionDetail,
} from "@/lib/professions/public";
import { fetchCategoryById } from "@/lib/categories/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import JobCard from "@/components/job-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profession | JobEthiopia",
  description: "Browse jobs in this profession on JobEthiopia.",
};

export default async function ProfessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let profession: PublicProfessionDetail | null = null;
  let loadError = false;

  try {
    profession = await fetchProfessionById(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Profession details</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load this profession right now. Please try again
          shortly.
        </p>
        <Link
          href="/professions"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Back to Professions
        </Link>
      </div>
    );
  }

  if (!profession) {
    notFound();
  }

  let category: { id: string; name: string } | null = null;
  if (profession.categoryId) {
    try {
      const categoryDetail = await fetchCategoryById(profession.categoryId);
      if (categoryDetail) {
        category = { id: categoryDetail.id, name: categoryDetail.name };
      }
    } catch {
      category = null;
    }
  }

  let professionJobs: PublicJobSummary[] = [];
  let jobsLoadError = false;
  try {
    const jobsResult = await fetchJobs({
      page: 1,
      limit: 8,
      status: "PUBLISHED",
      professionId: profession.id,
    });
    professionJobs = jobsResult.items ?? [];
  } catch {
    jobsLoadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/professions"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Professions
      </Link>

      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {profession.name}
          </h1>
        </header>

        {profession.description && (
          <p className="mt-3 text-gray-700 dark:text-gray-200">
            {profession.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
          {category && (
            <Link
              href={`/categories/${category.id}`}
              className="rounded-md bg-gray-100 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Part of {category.name}
            </Link>
          )}
        </div>

        <Link
          href={`/jobs?professionId=${encodeURIComponent(profession.id)}`}
          className="mt-5 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Browse jobs in this profession
        </Link>
      </article>

      <section aria-labelledby="profession-jobs-heading" className="mt-10">
        <h2
          id="profession-jobs-heading"
          className="text-xl font-bold tracking-tight"
        >
          Jobs in {profession.name}
        </h2>

        {jobsLoadError ? (
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            We could not load jobs in this profession right now. Please try
            again shortly.
          </p>
        ) : professionJobs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <h3 className="text-lg font-semibold">
              No open jobs in this profession.
            </h3>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              There are no published jobs in this profession at the moment.
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
            {professionJobs.map((job) => (
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
