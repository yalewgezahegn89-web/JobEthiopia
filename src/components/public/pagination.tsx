import Link from "next/link";

export function Pagination({
  currentPage,
  totalPages,
  hrefForPage,
}: {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  return (
    <nav
      className="mt-10 flex items-center justify-between gap-4"
      aria-label="Pagination"
    >
      {currentPage > 1 ? (
        <Link
          href={hrefForPage(currentPage - 1)}
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-raised hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-subtle opacity-60">
          <ArrowLeft className="h-4 w-4" />
          Previous
        </span>
      )}

      <div className="hidden items-center gap-1.5 sm:flex" aria-label="Pages">
        {start > 1 && (
          <>
            <PageLink page={1} currentPage={currentPage} hrefForPage={hrefForPage} />
            {start > 2 && <span className="px-1 text-subtle">…</span>}
          </>
        )}
        {pages.map((p) => (
          <PageLink key={p} page={p} currentPage={currentPage} hrefForPage={hrefForPage} />
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-subtle">…</span>}
            <PageLink page={totalPages} currentPage={currentPage} hrefForPage={hrefForPage} />
          </>
        )}
      </div>

      {currentPage < totalPages ? (
        <Link
          href={hrefForPage(currentPage + 1)}
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-raised hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-subtle opacity-60">
          Next
          <ArrowRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

function PageLink({
  page,
  currentPage,
  hrefForPage,
}: {
  page: number;
  currentPage: number;
  hrefForPage: (page: number) => string;
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
      href={hrefForPage(page)}
      className="focus-visible:outline-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {page}
    </Link>
  );
}

function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}