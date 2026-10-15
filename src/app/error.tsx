"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {t.error.title}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
        {t.error.genericHeading}
      </h1>
      <p className="mt-3 max-w-md text-muted">{t.error.genericBody}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.common.tryAgain}
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.common.backToHome}
        </Link>
        <Link
          href="/jobs"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.error.browseJobs}
        </Link>
      </div>
    </div>
  );
}
