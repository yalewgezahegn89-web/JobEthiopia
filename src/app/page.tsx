import Link from "next/link";
import { fetchJobs } from "@/lib/jobs/public";
import { fetchCareerArticles } from "@/lib/careerArticles/public";
import { fetchCategories } from "@/lib/categories/public";
import { fetchProfessions } from "@/lib/professions/public";
import { fetchLocations } from "@/lib/locations/public";
import { selectClosingJobs } from "@/lib/jobs/closing";
import { Hero } from "@/components/homepage/hero";
import { TrustSignals } from "@/components/homepage/trust-signals";
import { LatestJobs, ClosingSoon } from "@/components/homepage/jobs";
import { ExploreByPath } from "@/components/homepage/explore";
import { EmployerCta } from "@/components/homepage/employer-cta";
import { CareerResources } from "@/components/homepage/career-resources";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [jobsResult, articlesResult, closingResult, categoriesResult, professionsResult, locationsResult] =
    await Promise.all([
      fetchJobs({ limit: 5 }).catch(() => null),
      fetchCareerArticles({ limit: 3 }).catch(() => null),
      fetchJobs({ page: 1, limit: 20, status: "PUBLISHED" }).catch(() => null),
      fetchCategories({ limit: 12 }).catch(() => null),
      fetchProfessions({ limit: 12 }).catch(() => null),
      fetchLocations({ limit: 12 }).catch(() => null),
    ]);

  const jobs = jobsResult?.items ?? [];
  const articles = articlesResult?.items ?? [];
  const closingJobs = selectClosingJobs(closingResult?.items ?? [], {
    count: 5,
  });
  const categories = categoriesResult?.items ?? [];
  const professions = professionsResult?.items ?? [];
  const locations = locationsResult?.items ?? [];

  return (
    <div className="flex w-full flex-col">
      <Hero locations={locations} />

      <TrustSignals />

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-14 sm:space-y-20 sm:py-16">
        {jobsResult === null || jobs.length === 0 ? (
          <JobsEmptyState />
        ) : (
          <LatestJobs jobs={jobs} />
        )}

        {closingJobs.length > 0 && <ClosingSoon jobs={closingJobs} />}

        <ExploreByPath
          professions={professions}
          categories={categories}
          locations={locations}
        />
      </div>

      <EmployerCta />

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-14 sm:py-16">
        {articlesResult === null || articles.length === 0 ? (
          <ResourcesEmptyState />
        ) : (
          <CareerResources articles={articles} />
        )}
      </div>
    </div>
  );
}

function JobsEmptyState() {
  return (
    <section
      aria-labelledby="latest-jobs-heading"
      className="rounded-xl border border-dashed border-border p-8 text-center"
    >
      <h2
        id="latest-jobs-heading"
        className="text-2xl font-bold tracking-tight text-foreground"
      >
        Latest Jobs
      </h2>
      <p className="mt-2 text-sm text-muted">
        We could not load the latest jobs right now.
      </p>
      <Link
        href="/jobs"
        className="focus-visible:outline-2 mt-4 inline-block font-semibold text-primary underline focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Browse jobs
      </Link>
    </section>
  );
}

function ResourcesEmptyState() {
  return (
    <section
      aria-labelledby="resources-heading"
      className="rounded-xl border border-dashed border-border p-8 text-center"
    >
      <h2
        id="resources-heading"
        className="text-2xl font-bold tracking-tight text-foreground"
      >
        Career Resources
      </h2>
      <p className="mt-2 text-sm text-muted">
        We could not load the latest career resources right now.
      </p>
      <Link
        href="/careers"
        className="focus-visible:outline-2 mt-4 inline-block font-semibold text-primary underline focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Browse career resources
      </Link>
    </section>
  );
}
