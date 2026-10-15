import { getI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const t = await getI18n();

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
        {t.common.loadingEllipsis}
      </p>
      <span className="sr-only">{t.common.loading}</span>
    </div>
  );
}
