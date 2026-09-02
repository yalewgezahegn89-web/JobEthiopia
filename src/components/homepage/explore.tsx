import Link from "next/link";
import type { PublicCategorySummary } from "@/lib/categories/public";
import type { PublicProfessionSummary } from "@/lib/professions/public";
import type { PublicLocationSummary } from "@/lib/locations/public";

export function ExploreByPath({
  professions,
  categories,
  locations,
}: {
  professions: PublicProfessionSummary[];
  categories: PublicCategorySummary[];
  locations: PublicLocationSummary[];
}) {
  return (
    <div className="space-y-14">
      <ProfessionCategoryGrid professions={professions} categories={categories} />
      <LocationGrid locations={locations} />
    </div>
  );
}

function ProfessionCategoryGrid({
  professions,
  categories,
}: {
  professions: PublicProfessionSummary[];
  categories: PublicCategorySummary[];
}) {
  const hasProfessions = professions.length > 0;
  const hasCategories = categories.length > 0;
  if (!hasProfessions && !hasCategories) return null;

  return (
    <section aria-labelledby="explore-heading">
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Explore
        </p>
        <h2
          id="explore-heading"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Explore careers by path
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Browse opportunities across professions and categories to find the
          direction that fits your goals.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {professions.slice(0, 6).map((profession) => (
          <Link
            key={profession.id}
            href={`/professions/${profession.id}`}
            className="group flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <BriefcaseIcon />
            </span>
            <div>
              <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                {profession.name}
              </h3>
              {profession.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {profession.description}
                </p>
              )}
            </div>
          </Link>
        ))}
        {categories.slice(0, 3).map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.id}`}
            className="group flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-accent/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-warning transition-colors group-hover:bg-accent group-hover:text-white">
              <FolderIcon />
            </span>
            <div>
              <h3 className="font-semibold text-foreground transition-colors group-hover:text-warning">
                {category.name}
                {category.parentId && (
                  <span className="ml-2 text-xs font-medium text-subtle">
                    Subcategory
                  </span>
                )}
              </h3>
              {category.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {category.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href="/professions"
          className="focus-visible:outline-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View all professions
        </Link>
        <Link
          href="/categories"
          className="focus-visible:outline-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View all categories
        </Link>
      </div>
    </section>
  );
}

function LocationGrid({ locations }: { locations: PublicLocationSummary[] }) {
  if (locations.length === 0) return null;

  return (
    <section aria-labelledby="locations-heading">
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Locations
        </p>
        <h2
          id="locations-heading"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Explore jobs by location
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Discover opportunities in cities and regions across Ethiopia.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations.slice(0, 9).map((location) => (
          <li key={location.id}>
            <Link
              href={`/locations/${location.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-primary">
                <PinIcon />
              </span>
              <span className="font-medium text-foreground transition-colors group-hover:text-primary">
                {location.name}
              </span>
              <span className="ml-auto text-xs text-subtle">
                {location.type.replace("_", " ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link
          href="/locations"
          className="focus-visible:outline-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View all locations
        </Link>
      </div>
    </section>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      className="h-5 w-5"
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
  );
}

function FolderIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
