import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { getCandidateRecommendations } from "@/lib/matching/dal";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { SparkleIcon } from "@/components/public/icons";
import { getI18n } from "@/lib/i18n/server";
import { trackMatchEvent } from "@/lib/analytics/matchingEvents";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recommended Jobs | JobEthiopia",
  description: "Jobs recommended for you on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function RecommendationsPage() {
  const t = await getI18n();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect("/jobs");

  let items:
    | Awaited<ReturnType<typeof getCandidateRecommendations>>
    | undefined;
  let loadError = false;
  try {
    items = await getCandidateRecommendations(user.id);
  } catch {
    loadError = true;
  }

  const recommendations = items ?? [];

  try {
    await trackMatchEvent({
      event: "match_recommendations_viewed",
      metadata: { resultCount: recommendations.length },
    });
  } catch {
    // Best-effort capture must never break the page.
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: t.recommendations.breadcrumbHome, href: "/" },
          { label: t.recommendations.breadcrumbRecommendations },
        ]}
        t={t}
      />

      <header className="mt-4 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.recommendations.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.recommendations.title}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted">
          {t.recommendations.subtitle}
        </p>
      </header>

      <div className="mt-5 inline-flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.recommendations.browseJobs}
        </Link>
        <Link
          href="/saved-jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.nav.savedJobs}
        </Link>
      </div>

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
            <SparkleIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-muted">{t.recommendations.loadErrorBody}</p>
          <Link
            href="/recommendations"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.recommendations.retryCta}
          </Link>
        </div>
      ) : recommendations.length === 0 ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <SparkleIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-foreground">
            {t.recommendations.noDataHeading}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            {t.recommendations.noDataBody}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.recommendations.noDataProfileCta}
            </Link>
            <Link
              href="/jobs"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface-raised px-6 py-2.5 text-sm font-semibold text-foreground hover:border-primary/30 hover:shadow-sm focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.recommendations.noDataBrowseCta}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {recommendations.map((item) => (
            <RecommendationCard key={item.job.id} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}