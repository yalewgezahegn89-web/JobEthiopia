import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { listSavedJobs } from "@/lib/savedJobs/dal";
import { SavedJobList } from "@/components/saved-jobs/saved-job-list";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { Pagination } from "@/components/public/pagination";
import { SaveIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Jobs | JobEthiopia",
  description: "Jobs you have saved on JobEthiopia.",
  robots: "noindex, nofollow",
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

export default async function SavedJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect("/jobs");

  const page = toPositiveInteger(firstValue(params.page), 1);

  let result;
  let loadError = false;
  try {
    result = await listSavedJobs(user.id, { page, limit: 20 });
  } catch {
    loadError = true;
  }

  const items = result?.items ?? [];
  const currentPage = result?.page ?? 1;
  const totalPages = result?.totalPages ?? 1;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Saved Jobs" }]}
      />

      <header className="mt-4 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Candidate workspace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Saved Jobs
        </h1>
        <p className="mt-2 text-base leading-7 text-muted">
          Jobs you have saved for later.
        </p>
      </header>

      <div className="mt-5 inline-flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Browse jobs
        </Link>
        <Link
          href="/applications"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          My Applications
        </Link>
      </div>

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
            <SaveIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-muted">
            We could not load your saved jobs right now. Please try again
            shortly.
          </p>
          <Link
            href="/saved-jobs"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Retry
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <SaveIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-foreground">
            Your saved jobs will appear here
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            Save opportunities while you browse and come back to them later.
          </p>
          <Link
            href="/jobs"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Browse jobs
          </Link>
        </div>
      ) : (
        <>
          <SavedJobList items={items} />

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