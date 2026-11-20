import { LocalizedLink } from "@/components/i18n/localized-link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getI18n();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {t.notFound.code}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
        {t.notFound.heading}
      </h1>
      <p className="mt-3 max-w-md text-muted">{t.notFound.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LocalizedLink
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.common.home}
        </LocalizedLink>
        <LocalizedLink
          href="/jobs"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.notFound.jobs}
        </LocalizedLink>
        <LocalizedLink
          href="/careers"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.notFound.careers}
        </LocalizedLink>
        <LocalizedLink
          href="/organizations"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.notFound.organizations}
        </LocalizedLink>
      </div>
    </div>
  );
}
