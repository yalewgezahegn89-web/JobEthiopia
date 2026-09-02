import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLocations,
  type PublicLocationList,
  type PublicLocationSummary,
} from "@/lib/locations/public";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { PageHeader } from "@/components/public/page-header";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { PinIcon, GlobeIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations | JobEthiopia",
  description: "Browse job locations across Ethiopia.",
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

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicLocationList | null = null;
  let loadError = false;

  try {
    result = await fetchLocations({ page, limit: 20 });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Locations</h1>
        <p className="mt-4 text-muted">
          We could not load locations right now. Please try again shortly.
        </p>
        <Link
          href="/locations"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Retry
        </Link>
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
  const totalPages = pagination.totalPages;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Locations" }]} />

      <div className="mt-4">
        <PageHeader
          eyebrow="Explore by region"
          title="Locations"
          description="Explore jobs by location and find opportunities near you across Ethiopia."
        />
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-muted">
        <GlobeIcon className="h-4 w-4 text-primary" />
        <span>Countries, regions, cities, and districts</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<PinIcon className="h-7 w-7" />}
          heading="No locations found"
          body="There are no active locations to show right now. Check back soon."
        />
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((location, index) => (
              <li key={location.id} className="h-full">
                <LocationCard location={location} index={index} />
              </li>
            ))}
          </ul>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            hrefForPage={hrefWithPage}
          />
        </>
      )}
    </div>
  );
}

function LocationCard({
  location,
  index,
}: {
  location: PublicLocationSummary;
  index: number;
}) {
  const amber = index % 2 === 1;
  return (
    <Link
      href={`/locations/${location.id}`}
      className="group flex h-full items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
          amber ? "bg-accent-light text-warning" : "bg-primary-light text-primary"
        }`}
      >
        <PinIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-1 text-base font-semibold tracking-tight text-foreground">
          {location.name}
        </h2>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-subtle">
          {location.type.replace("_", " ")}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}