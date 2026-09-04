export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10"
      role="status"
      aria-live="polite"
    >
      <nav aria-label="Breadcrumb" className="py-1">
        <div className="flex items-center gap-1.5 text-sm">
          <div className="h-3 w-10 animate-pulse rounded bg-surface-raised" />
          <span aria-hidden="true" className="text-subtle">/</span>
          <div className="h-3 w-8 animate-pulse rounded bg-surface-raised" />
          <span aria-hidden="true" className="text-subtle">/</span>
          <div className="h-3 w-40 animate-pulse rounded bg-surface-raised" />
        </div>
      </nav>

      <div className="mt-5 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-xl bg-surface-raised" />
            <div>
              <div className="h-4 w-28 animate-pulse rounded bg-surface-raised" />
              <div className="mt-1 h-5 w-16 animate-pulse rounded-full bg-surface-raised" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-surface-raised" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-raised" />
          </div>
        </div>

        <div className="mt-5 h-8 w-72 animate-pulse rounded bg-surface-raised sm:h-9" />

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-surface-raised" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-surface-raised" />
          <div className="h-6 w-28 animate-pulse rounded-full bg-surface-raised" />
          <div className="h-6 w-22 animate-pulse rounded-full bg-surface-raised" />
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section>
            <div className="h-5 w-32 animate-pulse rounded bg-surface-raised" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
              <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-raised" />
            </div>
          </section>
          <section>
            <div className="h-5 w-36 animate-pulse rounded bg-surface-raised" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-surface-raised" />
            </div>
          </section>
          <section>
            <div className="h-5 w-28 animate-pulse rounded bg-surface-raised" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-surface-raised" />
            </div>
          </section>
        </div>

        <aside aria-label="Job overview" className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
            <div className="mt-4 h-12 w-full animate-pulse rounded-lg bg-surface-raised" />
            <div className="mt-4 flex gap-2.5">
              <div className="h-9 w-20 animate-pulse rounded-lg bg-surface-raised" />
              <div className="h-9 w-20 animate-pulse rounded-lg bg-surface-raised" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-surface-raised" />
                <div className="h-3 w-24 animate-pulse rounded bg-surface-raised" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-raised" />
                <div className="h-3 w-28 animate-pulse rounded bg-surface-raised" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-18 animate-pulse rounded bg-surface-raised" />
                <div className="h-3 w-20 animate-pulse rounded bg-surface-raised" />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <span className="sr-only">Loading job details…</span>
    </div>
  );
}
