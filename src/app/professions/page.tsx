import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchProfessions,
  type PublicProfessionList,
} from "@/lib/professions/public";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { PageHeader } from "@/components/public/page-header";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { UserIcon, BriefcaseIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Professions | JobEthiopia",
  description: "Browse job professions across Ethiopia.",
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

export default async function ProfessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicProfessionList | null = null;
  let loadError = false;

  try {
    result = await fetchProfessions({ page, limit: 20 });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Professions</h1>
        <p className="mt-4 text-muted">
          We could not load professions right now. Please try again shortly.
        </p>
        <Link
          href="/professions"
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
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Professions" }]} />

      <div className="mt-4">
        <PageHeader
          eyebrow="Find your path"
          title="Professions"
          description="Find opportunities by profession and explore the roles that match your career path."
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon className="h-7 w-7" />}
          heading="No professions found"
          body="There are no active professions to show right now. Check back soon."
        />
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((profession) => (
              <li key={profession.id} className="h-full">
                <ProfessionCard profession={profession} />
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

function ProfessionCard({
  profession,
}: {
  profession: { id: string; name: string; description: string | null };
}) {
  return (
    <Link
      href={`/professions/${profession.id}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-light text-primary">
        <UserIcon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
        {profession.name}
      </h2>
      {profession.description && (
        <p className="mt-2 line-clamp-3 text-sm text-muted">
          {profession.description}
        </p>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">
        Explore profession
        <span className="transition-transform duration-200 group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}