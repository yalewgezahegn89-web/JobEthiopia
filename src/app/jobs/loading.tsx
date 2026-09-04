export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-3xl">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-raised" />
        <div className="h-9 w-64 animate-pulse rounded bg-surface-raised sm:h-10" />
        <div className="mt-3 h-5 w-80 animate-pulse rounded bg-surface-raised" />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-12 flex-1 animate-pulse rounded-lg bg-surface-raised" />
          <div className="h-12 w-24 animate-pulse rounded-lg bg-surface-raised" />
        </div>
        <div className="mt-4 border-t border-border-subtle pt-4">
          <div className="mb-3 h-3 w-12 animate-pulse rounded bg-surface-raised" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-10 animate-pulse rounded-lg bg-surface-raised" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-raised" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-raised" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-raised" />
          </div>
        </div>
      </div>

      <div className="mt-8 h-4 w-40 animate-pulse rounded bg-surface-raised" />

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-full">
            <div className="h-full rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 animate-pulse rounded-md bg-surface-raised" />
                <div className="h-4 w-28 animate-pulse rounded bg-surface-raised" />
              </div>
              <div className="mt-3 h-5 w-48 animate-pulse rounded bg-surface-raised" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-surface-raised" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-raised" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-surface-raised" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-surface-raised" />
              </div>
              <div className="mt-4 border-t border-border-subtle pt-3">
                <div className="h-3 w-24 animate-pulse rounded bg-surface-raised" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <span className="sr-only">Loading jobs…</span>
    </div>
  );
}
