import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCategoryById,
  type PublicCategoryDetail,
} from "@/lib/categories/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import JobCard from "@/components/job-card";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { TagIcon } from "@/components/public/icons";

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
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Category details</h1>
        <p className="mt-4 text-muted">
          We could not load this category right now. Please try again shortly.
        </p>
        <Link
          href="/categories"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
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
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Categories", href: "/categories" },
          { label: category.name },
        ]}
      />

      <header className="mt-4 flex flex-wrap items-start gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <TagIcon className="h-8 w-8" />
        </span>
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-2 text-base leading-7 text-muted">
              {category.description}
            </p>
          )}
          <Link
            href={`/jobs?categoryId=${encodeURIComponent(category.id)}`}
            className="focus-visible:outline-2 mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Browse all jobs in this category
          </Link>
        </div>
      </header>

      <section aria-labelledby="category-jobs-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Latest in {category.name}
            </p>
            <h2
              id="category-jobs-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Jobs in {category.name}
            </h2>
          </div>
          <Link
            href={`/jobs?categoryId=${encodeURIComponent(category.id)}`}
            className="focus-visible:outline-2 hidden shrink-0 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            View all jobs
          </Link>
        </div>

        {jobsLoadError ? (
          <p className="mt-4 text-muted">
            We could not load jobs in this category right now. Please try again
            shortly.
          </p>
        ) : categoryJobs.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
              <TagIcon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No jobs right now
            </h3>
            <p className="mt-1 text-sm text-muted">
              There are no published jobs in this category at the moment.
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
            {categoryJobs.map((job) => (
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