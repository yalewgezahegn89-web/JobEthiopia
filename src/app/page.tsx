import Link from "next/link";
import { fetchJobs } from "@/lib/jobs/public";
import { fetchCareerArticles } from "@/lib/careerArticles/public";
import JobCard from "@/components/job-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [jobsResult, articlesResult] = await Promise.all([
    fetchJobs({ limit: 5 }).catch(() => null),
    fetchCareerArticles({ limit: 3 }).catch(() => null),
  ]);

  const jobs = jobsResult?.items ?? [];
  const articles = articlesResult?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <section className="py-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-gray-50">
          JobEthiopia
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
          An Ethiopian job and career platform.
        </p>
        <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
          Discover fresh, relevant, and trustworthy job opportunities and
          career resources across Ethiopia.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/jobs"
            className="rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Browse Jobs
          </Link>
          <Link
            href="/careers"
            className="rounded-md border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Career Resources
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Search Jobs
        </h2>
        <form
          action="/jobs"
          method="get"
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="q" className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              Search jobs
            </label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="e.g. nurse, engineer, Addis Ababa"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Search
          </button>
        </form>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Latest Jobs
          </h2>
          <Link
            href="/jobs"
            className="text-sm font-semibold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-400"
          >
            View all jobs
          </Link>
        </div>

        {jobsResult === null ? (
          <div
            className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
            role="status"
          >
            <p className="text-gray-600 dark:text-gray-300">
              We could not load the latest jobs right now.
            </p>
            <Link
              href="/jobs"
              className="mt-3 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
            >
              Browse jobs
            </Link>
          </div>
        ) : jobs.length === 0 ? (
          <div
            className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
            role="status"
          >
            <p className="text-gray-600 dark:text-gray-300">
              No jobs are available right now.
            </p>
            <Link
              href="/jobs"
              className="mt-3 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
            >
              View all jobs
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Career Resources
          </h2>
          <Link
            href="/careers"
            className="text-sm font-semibold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-400"
          >
            View all resources
          </Link>
        </div>

        {articlesResult === null ? (
          <div
            className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
            role="status"
          >
            <p className="text-gray-600 dark:text-gray-300">
              We could not load the latest career resources right now.
            </p>
            <Link
              href="/careers"
              className="mt-3 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
            >
              Browse career resources
            </Link>
          </div>
        ) : articles.length === 0 ? (
          <div
            className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
            role="status"
          >
            <p className="text-gray-600 dark:text-gray-300">
              No career resources are available right now.
            </p>
            <Link
              href="/careers"
              className="mt-3 inline-block font-semibold text-blue-600 underline dark:text-blue-400"
            >
              Browse career resources
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/careers/${article.id}`}
                  className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                    {article.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                    {article.category && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        {article.category}
                      </span>
                    )}
                    {article.publishedAt && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        Published {article.publishedAt}
                      </span>
                    )}
                  </div>
                  {article.excerpt && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {article.excerpt}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}