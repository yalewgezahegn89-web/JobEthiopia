import type { Metadata } from "next";
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
import AdSlot from "@/components/ads/ad-slot";
import { getI18n, getCurrentLocale } from "@/lib/i18n/server";
import { trackPageView } from "@/lib/analytics/pageEvents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();
  return {
    title: t.home.metaTitle,
    description: t.home.metaDescription,
  };
}

export default async function Home() {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const [jobsResult, articlesResult, categoriesResult, professionsResult, locationsResult] =
    await Promise.all([
      fetchJobs({ page: 1, limit: 20, status: "PUBLISHED" }).catch(() => null),
      fetchCareerArticles({ limit: 3 }).catch(() => null),
      fetchCategories({ limit: 12 }).catch(() => null),
      fetchProfessions({ limit: 12 }).catch(() => null),
      fetchLocations({ limit: 12 }).catch(() => null),
    ]);

  const items = jobsResult?.items ?? [];
  const jobs = items.slice(0, 5);
  const articles = articlesResult?.items ?? [];
  const closingJobs = selectClosingJobs(items, {
    count: 5,
  });
  const categories = categoriesResult?.items ?? [];
  const professions = professionsResult?.items ?? [];
  const locations = locationsResult?.items ?? [];

  try {
    await trackPageView({ pathname: "/", locale });
  } catch {
    // Best-effort capture must never break the page.
  }

  return (
    <div className="flex w-full flex-col">
      <Hero locations={locations} t={t} />

      <TrustSignals t={t} />

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-14 sm:space-y-20 sm:py-16">
        <AdSlot placementId="home-banner" pathname="/" locale={locale} t={t} />

        {jobsResult === null || jobs.length === 0 ? (
          <JobsEmptyState t={t} />
        ) : (
          <LatestJobs jobs={jobs} t={t} />
        )}

        {closingJobs.length > 0 && <ClosingSoon jobs={closingJobs} t={t} />}

        <ExploreByPath
          professions={professions}
          categories={categories}
          locations={locations}
          t={t}
        />
      </div>

      <EmployerCta t={t} />

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-14 sm:py-16">
        {articlesResult === null || articles.length === 0 ? (
          <ResourcesEmptyState t={t} />
        ) : (
          <CareerResources articles={articles} t={t} />
        )}
      </div>
    </div>
  );
}

function JobsEmptyState({ t }: { t: Awaited<ReturnType<typeof getI18n>> }) {
  return (
    <section
      aria-labelledby="latest-jobs-heading"
      className="rounded-xl border border-dashed border-border p-8 text-center"
    >
      <h2
        id="latest-jobs-heading"
        className="text-2xl font-bold tracking-tight text-foreground"
      >
        {t.home.latestJobsEmptyHeading}
      </h2>
      <p className="mt-2 text-sm text-muted">{t.home.latestJobsEmptyBody}</p>
      <Link
        href="/jobs"
        className="focus-visible:outline-2 mt-4 inline-block font-semibold text-primary underline focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.home.latestJobsEmptyCta}
      </Link>
    </section>
  );
}

function ResourcesEmptyState({ t }: { t: Awaited<ReturnType<typeof getI18n>> }) {
  return (
    <section
      aria-labelledby="resources-heading"
      className="rounded-xl border border-dashed border-border p-8 text-center"
    >
      <h2
        id="resources-heading"
        className="text-2xl font-bold tracking-tight text-foreground"
      >
        {t.home.resourcesEmptyHeading}
      </h2>
      <p className="mt-2 text-sm text-muted">{t.home.resourcesEmptyBody}</p>
      <Link
        href="/careers"
        className="focus-visible:outline-2 mt-4 inline-block font-semibold text-primary underline focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.home.resourcesEmptyCta}
      </Link>
    </section>
  );
}
