import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCategoryById,
  type PublicCategoryDetail,
} from "@/lib/categories/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import JobCard from "@/components/job-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Category | JobEthiopia",
  description: "Browse jobs in this category on JobEthiopia.",
};

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let category: PublicCategoryDetail | null = null;
  let loadError = false;

  try {
    category = await fetchCategoryById(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Category details</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          We could not load this category right now. Please try again shortly.
        </p>
        <Link
          href="/categories"
          className="mt-6 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
        >
          Back to Categories
        </Link>
      </div>
    );
  }

  if (!category) {
    notFound();
  }

  let categoryJobs: PublicJobSummary[] = [];
  let jobsLoadError = false;
  try {
    const jobsResult = await fetchJobs({
      page: 1,
      limit: 8,
      status: "PUBLISHED",
      categoryId: category.id,
    });
    categoryJobs = jobsResult.items ?? [];
  } catch {
    jobsLoadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/categories"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Categories
      </Link>

      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {category.name}
          </h1>
        </header>

        {category.description && (
          <p className="mt-3 text-gray-700 dark:text-gray-200">
            {category.description}
          </p>
        )}

        <Link
          href={`/jobs?categoryId=${encodeURIComponent(category.id)}`}
          className="mt-5 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Browse jobs in this category
        </Link>
      </article>

      <section aria-labelledby="category-jobs-heading" className="mt-10">
        <h2
          id="category-jobs-heading"
          className="text-xl font-bold tracking-tight"
        >
          Jobs in {category.name}
        </h2>

        {jobsLoadError ? (
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            We could not load jobs in this category right now. Please try again
            shortly.
          </p>
        ) : categoryJobs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <h3 className="text-lg font-semibold">No jobs right now</h3>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              There are no published jobs in this category at the moment.
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
            {categoryJobs.map((job) => (
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
