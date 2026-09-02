export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 py-24 text-center"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      <p className="text-sm font-medium text-muted">
        Loading…
      </p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
