import Link from "next/link";
import type { PublicLocationSummary } from "@/lib/locations/public";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function Hero({ locations, t }: { locations: PublicLocationSummary[]; t: Dictionary }) {

  return (
    <section className="relative overflow-hidden">
      <HeroGeometry />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              {t.home.trustedMarketplace}
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t.home.heroTitle}{" "}
              <span className="text-primary">{t.home.heroTitleHighlight}</span>{" "}
              {t.home.heroTitleTail}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
              {t.home.heroSubtitle}
            </p>

            <SearchPanel locations={locations} t={t} />

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted">
              <span>
                <Link
                  href="/professions"
                  className="font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t.home.browseProfessions}
                </Link>
              </span>
              <span className="h-1 w-1 rounded-full bg-subtle" aria-hidden="true" />
              <span>
                <Link
                  href="/locations"
                  className="font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t.home.browseLocations}
                </Link>
              </span>
              <span className="h-1 w-1 rounded-full bg-subtle" aria-hidden="true" />
              <span>
                <Link
                  href="/categories"
                  className="font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t.home.browseCategories}
                </Link>
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            <EmployerPanel t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchPanel({
  locations,
  t,
}: {
  locations: PublicLocationSummary[];
  t: Dictionary;
}) {
  return (
    <form
      action="/jobs"
      aria-label={t.search.searchJobs}
      method="get"
      className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-md"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label htmlFor="q" className="sr-only">
          {t.search.searchKeywordLabel}
        </label>
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle"
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
          <input
            id="q"
            name="q"
            type="search"
            placeholder={t.search.searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface-raised py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>

        {locations.length > 0 && (
          <div className="relative sm:w-56">
            <label htmlFor="locationId" className="sr-only">
              {t.search.filterByLocation}
            </label>
            <select
              id="locationId"
              name="locationId"
              className="w-full appearance-none rounded-lg border border-border bg-surface-raised py-3 pl-4 pr-9 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">{t.search.allLocations}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
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
        )}

        <button
          type="submit"
          className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.search.search}
        </button>
      </div>
    </form>
  );
}

function EmployerPanel({
  t,
}: {
  t: Dictionary;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
        <svg
          className="h-6 w-6 text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold text-foreground">
        {t.home.employerPanelTitle}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {t.home.employerPanelBody}
      </p>
      <Link
        href="/employer/register"
        className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t.home.employerPanelCta}
      </Link>
      <p className="mt-3 text-xs text-subtle">{t.home.employerPanelNote}</p>
    </div>
  );
}

function HeroGeometry() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0">
      <svg
        className="absolute -right-20 -top-24 h-[36rem] w-[36rem] text-primary/5"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="currentColor" strokeWidth="1">
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={`a-${i}`}
              x1={20 + i * 12}
              y1="0"
              x2={20 + i * 12}
              y2="200"
            />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={`b-${i}`}
              x1="0"
              y1={20 + i * 12}
              x2="200"
              y2={20 + i * 12}
            />
          ))}
        </g>
      </svg>
      <svg
        className="absolute -left-24 bottom-0 h-72 w-72 text-accent/10"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 8 L62 38 L92 50 L62 62 L50 92 L38 62 L8 50 L38 38 Z"
          fill="currentColor"
        />
        <path
          d="M50 26 L57 44 L75 50 L57 56 L50 74 L43 56 L25 50 L43 44 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
