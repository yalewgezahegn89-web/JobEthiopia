export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 py-24 text-center"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100"
      />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        Loading…
      </p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
