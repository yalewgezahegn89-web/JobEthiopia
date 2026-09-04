import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchJobs,
  type PublicJobList,
  type PublicJobSummary,
} from "@/lib/jobs/public";
import { fetchCategories } from "@/lib/categories/public";
import { fetchProfessions } from "@/lib/professions/public";
import { fetchLocations } from "@/lib/locations/public";
import JobCard from "@/components/job-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs | JobEthiopia",
  description: "Browse job openings across Ethiopia.",
};

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamsValue>;

function firstValue(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

type FilterOption = { id: string; name: string };

function uniqueEmploymentTypes(items: PublicJobSummary[]): string[] {
  const values = items
    .map((item) => item.employmentType)
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const q = firstValue(params.q) ?? "";
  const categoryId = firstValue(params.categoryId);
  const professionId = firstValue(params.professionId);
  const locationId = firstValue(params.locationId);
  const employmentType = firstValue(params.employmentType);
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicJobList | null = null;
  let loadError = false;

  const [jobsResult, categoriesResult, professionsResult, locationsResult] =
    await Promise.all([
      fetchJobs({
        q: q || undefined,
        categoryId,
        professionId,
        locationId,
        employmentType,
        page,
        limit: 20,
      }).catch(() => null),
      fetchCategories({ limit: 200 }).catch(() => null),
      fetchProfessions({ limit: 200 }).catch(() => null),
      fetchLocations({ limit: 200 }).catch(() => null),
    ]);

  if (jobsResult === null) {
    loadError = true;
  } else {
    result = jobsResult;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <ErrorState
          heading="We could not load jobs"
          body="Something went wrong while loading job listings. Please try again shortly."
          ctaHref="/jobs"
          ctaLabel="Try again"
        />
      </div>
    );
  }

  const items = result?.items ?? [];
  const pagination = result?.pagination ?? {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };
  const currentPage = pagination.page;
  const total = pagination.total;
  const totalPages = pagination.totalPages;

  const categories = (categoriesResult?.items ?? [])
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const professions = (professionsResult?.items ?? [])
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const locations = (locationsResult?.items ?? [])
    .map((l) => ({ id: l.id, name: l.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const employmentTypes = uniqueEmploymentTypes(items);

  const hasFilters = Boolean(
    q || categoryId || professionId || locationId || employmentType,
  );

  function hrefWith(
    paramsToSet: Record<string, string | number | undefined>,
  ): string {
    const query = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      q: q || undefined,
      categoryId,
      professionId,
      locationId,
      employmentType,
      page: paramsToSet.page,
      ...paramsToSet,
    };
    if (merged.q) query.set("q", String(merged.q));
    if (merged.categoryId) query.set("categoryId", String(merged.categoryId));
    if (merged.professionId)
      query.set("professionId", String(merged.professionId));
    if (merged.locationId) query.set("locationId", String(merged.locationId));
    if (merged.employmentType)
      query.set("employmentType", String(merged.employmentType));
    if (merged.page) query.set("page", String(merged.page));
    return `?${query.toString()}`;
  }

  const from = total === 0 ? 0 : (currentPage - 1) * pagination.limit + 1;
  const to = Math.min(currentPage * pagination.limit, total);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Job discovery
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Find a job that fits
        </h1>
        <p className="mt-2 text-base leading-7 text-muted">
          Search openings across Ethiopia and filter by profession, category,
          and location.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <SearchForm
          q={q}
          categories={categories}
          professions={professions}
          locations={locations}
          employmentTypes={employmentTypes}
          categoryId={categoryId}
          professionId={professionId}
          locationId={locationId}
          employmentType={employmentType}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <ResultCount total={total} from={from} to={to} />
        {hasFilters && (
          <Link
            href="/jobs"
            className="focus-visible:outline-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Clear all filters
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState hasFilters={hasFilters} noResult={result !== null} />
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map((job) => (
              <li key={job.id} className="h-full">
                <JobCard job={job} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-between gap-4"
              aria-label="Pagination"
            >
              {currentPage > 1 ? (
                <Link
                  href={hrefWith({ page: String(currentPage - 1) })}
                  className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-raised hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <ArrowIcon dir="left" />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-subtle opacity-60">
                  <ArrowIcon dir="left" />
                  Previous
                </span>
              )}

              <PageIndicator
                currentPage={currentPage}
                totalPages={totalPages}
                hrefFor={(p) => hrefWith({ page: String(p) })}
              />

              {currentPage < totalPages ? (
                <Link
                  href={hrefWith({ page: String(currentPage + 1) })}
                  className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-raised hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Next
                  <ArrowIcon dir="right" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-subtle opacity-60">
                  Next
                  <ArrowIcon dir="right" />
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function SearchForm({
  q,
  categories,
  professions,
  locations,
  employmentTypes,
  categoryId,
  professionId,
  locationId,
  employmentType,
}: {
  q: string;
  categories: FilterOption[];
  professions: FilterOption[];
  locations: FilterOption[];
  employmentTypes: string[];
  categoryId?: string;
  professionId?: string;
  locationId?: string;
  employmentType?: string;
}) {
  return (
    <form action="/jobs" aria-label="Search jobs" method="get" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <label htmlFor="q" className="sr-only">
            Search jobs by keyword
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q || ""}
            placeholder="Job title, keyword, or skill"
            className="w-full rounded-lg border border-border bg-surface-raised py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search
        </button>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Filters
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            id="categoryId"
            name="categoryId"
            label="Category"
            value={categoryId ?? ""}
            options={categories.map((o) => ({ value: o.id, label: o.name }))}
          />
          <SelectField
            id="professionId"
            name="professionId"
            label="Profession"
            value={professionId ?? ""}
            options={professions.map((o) => ({
              value: o.id,
              label: o.name,
            }))}
          />
          <SelectField
            id="locationId"
            name="locationId"
            label="Location"
            value={locationId ?? ""}
            options={locations.map((o) => ({ value: o.id, label: o.name }))}
          />
          <SelectField
            id="employmentType"
            name="employmentType"
            label="Employment type"
            value={employmentType ?? ""}
            options={employmentTypes.map((value) => ({
              value,
              label: value.replace("_", " "),
            }))}
          />
        </div>
      </div>
    </form>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={value}
          className="w-full appearance-none rounded-lg border border-border bg-surface-raised py-2.5 pl-3 pr-9 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <option value="">Any</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

function ResultCount({
  total,
  from,
  to,
}: {
  total: number;
  from: number;
  to: number;
}) {
  if (total === 0) {
    return <p className="text-sm text-muted">No jobs found</p>;
  }
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-foreground">{total}</span>{" "}
      {total === 1 ? "job" : "jobs"} found
      {` · Showing `}
      <span className="font-semibold text-foreground">
        {from}–{to}
      </span>
    </p>
  );
}

function PageIndicator({
  currentPage,
  totalPages,
  hrefFor,
}: {
  currentPage: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  return (
    <div className="hidden items-center gap-1.5 sm:flex" aria-label="Pages">
      {start > 1 && (
        <>
          <PageLink page={1} currentPage={currentPage} hrefFor={hrefFor} />
          {start > 2 && <span className="px-1 text-subtle">…</span>}
        </>
      )}
      {pages.map((p) => (
        <PageLink key={p} page={p} currentPage={currentPage} hrefFor={hrefFor} />
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-1 text-subtle">…</span>
          )}
          <PageLink
            page={totalPages}
            currentPage={currentPage}
            hrefFor={hrefFor}
          />
        </>
      )}
    </div>
  );
}

function PageLink({
  page,
  currentPage,
  hrefFor,
}: {
  page: number;
  currentPage: number;
  hrefFor: (page: number) => string;
}) {
  if (page === currentPage) {
    return (
      <span
        aria-current="page"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white"
      >
        {page}
      </span>
    );
  }
  return (
    <Link
      href={hrefFor(page)}
      className="focus-visible:outline-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {page}
    </Link>
  );
}

function EmptyState({
  hasFilters,
  noResult,
}: {
  hasFilters: boolean;
  noResult: boolean;
}) {
  const heading = hasFilters ? "No jobs found" : "No jobs available right now";
  const body =
    hasFilters && noResult
      ? "Try another keyword, location, or clear your filters to see more."
      : "Check back soon — new roles are added regularly.";
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
        <svg
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      </span>
      <h2 className="mt-5 text-xl font-bold text-foreground">{heading}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      <Link
        href="/jobs"
        className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Browse all jobs
      </Link>
    </div>
  );
}

function ErrorState({
  heading,
  body,
  ctaHref,
  ctaLabel,
}: {
  heading: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-light text-warning">
        <svg
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </span>
      <h2 className="mt-5 text-xl font-bold text-foreground">{heading}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      <Link
        href={ctaHref}
        className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

function ArrowIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      className={`h-4 w-4 ${dir === "left" ? "" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
