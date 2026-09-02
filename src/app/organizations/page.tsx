import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchOrganizations,
  type PublicOrganizationList,
  type PublicOrganizationSummary,
} from "@/lib/organizations/public";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { PageHeader } from "@/components/public/page-header";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { BuildingIcon, CheckIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organizations | JobEthiopia",
  description: "Browse organizations hiring across Ethiopia.",
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

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicOrganizationList | null = null;
  let loadError = false;

  try {
    result = await fetchOrganizations({ page, limit: 20 });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="mt-4 text-muted">
          We could not load organizations right now. Please try again shortly.
        </p>
        <Link
          href="/organizations"
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
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Organizations" }]} />

      <div className="mt-4">
        <PageHeader
          eyebrow="Hiring organizations"
          title="Organizations"
          description="Discover organizations hiring across Ethiopia and explore their open roles."
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon className="h-7 w-7" />}
          heading="No organizations found"
          body="There are no active organizations to show right now. Check back soon."
        />
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((organization) => (
              <li key={organization.id} className="h-full">
                <OrganizationCard organization={organization} />
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

export function OrganizationCard({
  organization,
}: {
  organization: PublicOrganizationSummary;
}) {
  return (
    <Link
      href={`/organizations/${organization.id}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex items-start gap-4">
        {organization.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organization.logoUrl}
            alt={`${organization.name} logo`}
            className="h-14 w-14 shrink-0 rounded-lg bg-surface-raised object-contain"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-light text-lg font-bold text-primary">
            {organizationInitials(organization.name)}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="line-clamp-1 text-base font-semibold text-foreground">
            {organization.name}
          </h2>
          {organization.isVerified && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
              <CheckIcon className="h-3 w-3" />
              Verified
            </span>
          )}
        </div>
      </div>

      {(organization.industry || organization.websiteUrl) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          {organization.industry && (
            <span className="inline-flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-subtle" />
              {organization.industry}
            </span>
          )}
          {organization.websiteUrl && (
            <span className="text-subtle">·</span>
          )}
          {organization.websiteUrl && (
            <span className="inline-flex items-center gap-1.5">
              Website
            </span>
          )}
        </div>
      )}

      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">
        View organization
        <span className="transition-transform duration-200 group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}

export function organizationInitials(name: string | null | undefined): string {
  if (!name) {
    return "?";
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}