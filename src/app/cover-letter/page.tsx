import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { listCoverLetters } from "@/lib/coverLetter/dal";
import { getI18n, getCurrentLocale } from "@/lib/i18n/server";
import { trackPageView } from "@/lib/analytics/pageEvents";
import { CoverLetterRowActions } from "@/components/cover-letter/cover-letter-row-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cover Letters | JobEthiopia",
  description: "Write and manage your cover letters on JobEthiopia.",
  robots: "noindex, nofollow",
};

function formatUpdated(date: Date, locale: string): string {
  try {
    const localeTag =
      locale === "am" ? "am-ET" : locale === "om" ? "en-ET" : "en-GB";
    return new Intl.DateTimeFormat(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export default async function CoverLetterDashboardPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  let letters: Awaited<ReturnType<typeof listCoverLetters>> = [];
  let loadError = false;
  try {
    letters = await listCoverLetters(user.id);
  } catch {
    loadError = true;
  }

  try {
    await trackPageView({ pathname: "/cover-letter", locale });
  } catch {
    // Best-effort capture must never break the page.
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.coverLetter.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.coverLetter.title}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t.coverLetter.subtitle}
        </p>
      </header>

      <div className="mt-6 flex items-center justify-between gap-4">
        <Link
          href="/cover-letter/create"
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.coverLetter.createCta}
        </Link>
      </div>

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="text-muted">{t.coverLetter.messages.error}</p>
          <Link
            href="/cover-letter"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.common.tryAgain}
          </Link>
        </div>
      ) : letters.length === 0 ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
        >
          <h2 className="text-xl font-bold text-foreground">
            {t.coverLetter.emptyHeading}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            {t.coverLetter.emptyBody}
          </p>
          <Link
            href="/cover-letter/create"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.coverLetter.createCta}
          </Link>
        </div>
      ) : (
        <section
          aria-label={t.coverLetter.listHeading}
          className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          <ul className="divide-y divide-border-subtle">
            {letters.map((letter) => (
              <li
                key={letter.id}
                className="flex flex-wrap items-center gap-4 p-5"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/cover-letter/${letter.id}`}
                    className="focus-visible:outline-2 text-base font-semibold text-foreground hover:text-primary focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {letter.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {letter.position}
                    {letter.employer ? ` · ${letter.employer}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {t.coverLetter.lastUpdated(
                      formatUpdated(letter.updatedAt, locale),
                    )}
                  </p>
                </div>
                <CoverLetterRowActions id={letter.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}