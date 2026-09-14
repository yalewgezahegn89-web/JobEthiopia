import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchProfessionById,
  type PublicProfessionDetail,
} from "@/lib/professions/public";
import { fetchCategoryById } from "@/lib/categories/public";
import { fetchJobs, type PublicJobSummary } from "@/lib/jobs/public";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import JobCard from "@/components/job-card";
import { getI18n } from "@/lib/i18n/server";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { UserIcon } from "@/components/public/icons";

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

  let profession: PublicProfessionDetail | null = null;
  try {
    profession = await fetchProfessionById(id);
  } catch {
    // fall through to fallback metadata
  }

  if (!profession) {
    return {
      title: "Profession | JobEthiopia",
      description: "Browse jobs in this profession on JobEthiopia.",
    };
  }

  const name = profession.name;
  const description = profession.description
    ? truncateMetadata(profession.description, 160)
    : `${name} — explore jobs in this profession on JobEthiopia.`;

  const baseUrl = getAppBaseUrl();
  const canonicalUrl = `${baseUrl}/professions/${id}`;

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

export default async function ProfessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getI18n();

  let profession: PublicProfessionDetail | null = null;
  let loadError = false;

  try {
    profession = await fetchProfessionById(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{t.publicDetail.professionTitle}</h1>
        <p className="mt-4 text-muted">
          {t.publicDetail.professionLoadError}
        </p>
        <Link
          href="/professions"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.publicDetail.professionBack}
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
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: t.publicDetail.professionBreadcrumbHome, href: "/" },
          { label: t.publicDetail.professionBreadcrumbProfessions, href: "/professions" },
          { label: profession.name },
        ]}
        t={t}
      />

      <header className="mt-4 flex flex-wrap items-start gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <UserIcon className="h-8 w-8" />
        </span>
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {profession.name}
          </h1>
          {profession.description && (
            <p className="mt-2 text-base leading-7 text-muted">
              {profession.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {category && (
              <Link
                href={`/categories/${category.id}`}
                className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {t.publicDetail.professionPartOf} {category.name}
              </Link>
            )}
            <Link
              href={`/jobs?professionId=${encodeURIComponent(profession.id)}`}
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.publicDetail.professionBrowseAll}
            </Link>
          </div>
        </div>
      </header>

      <section aria-labelledby="profession-jobs-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {t.publicDetail.professionLatestPrefix} {profession.name}
            </p>
            <h2
              id="profession-jobs-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              {t.publicDetail.professionJobsHeading(profession.name)}
            </h2>
          </div>
          <Link
            href={`/jobs?professionId=${encodeURIComponent(profession.id)}`}
            className="focus-visible:outline-2 hidden shrink-0 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            {t.publicDetail.professionViewAll}
          </Link>
        </div>

        {jobsLoadError ? (
          <p className="mt-4 text-muted">
            {t.publicDetail.professionJobsLoadError}
          </p>
        ) : professionJobs.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
              <UserIcon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {t.publicDetail.professionNoJobs}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t.publicDetail.professionNoJobsBody}
            </p>
            <Link
              href="/jobs"
              className="focus-visible:outline-2 mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.publicDetail.professionBrowseJobs}
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {professionJobs.map((job) => (
              <li key={job.id} className="h-full">
                <JobCard job={job} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}