import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { getOwnedCoverLetter } from "@/lib/coverLetter/dal";
import { getOwnedCv } from "@/lib/cv/dal";
import { recordCoverLetterPreviewAction } from "@/app/cover-letter/actions";
import {
  CoverLetterDocument,
  type CoverLetterDocumentLabels,
} from "@/components/cover-letter/cover-letter-document";
import { CoverLetterPreviewToolbar } from "@/components/cover-letter/cover-letter-preview-toolbar";
import { getI18n, getCurrentLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cover Letter Preview | JobEthiopia",
  description: "Preview and print your cover letter on JobEthiopia.",
  robots: "noindex, nofollow",
};

function todayText(locale: string): string {
  try {
    const localeTag =
      locale === "am" ? "am-ET" : locale === "om" ? "en-ET" : "en-GB";
    return new Intl.DateTimeFormat(localeTag, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default async function CoverLetterPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getI18n();
  const locale = await getCurrentLocale();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  const { id } = await params;

  let letter: Awaited<ReturnType<typeof getOwnedCoverLetter>> = null;
  let loadError = false;
  let cvContact: { phone: string | null; location: string | null } = {
    phone: null,
    location: null,
  };
  try {
    letter = await getOwnedCoverLetter(user.id, id);
    const cv = await getOwnedCv(user.id);
    if (cv) {
      cvContact = {
        phone: cv.header.phone,
        location: cv.header.location,
      };
    }
  } catch {
    loadError = true;
  }

  if (letter) {
    void recordCoverLetterPreviewAction();
  }

  const labels: CoverLetterDocumentLabels = {
    re: t.coverLetter.document.re,
    dear: t.coverLetter.document.dear,
    dearFallback: t.coverLetter.document.dearFallback,
    signoff: t.coverLetter.document.signoff,
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header className="print-hide">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.coverLetter.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.coverLetter.previewTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t.coverLetter.previewSubtitle}
        </p>
      </header>

      {letter ? (
        <div className="print-hide mt-6">
          <CoverLetterPreviewToolbar id={letter.id} />
        </div>
      ) : null}

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
      ) : letter === null ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="text-muted">{t.coverLetter.messages.notFound}</p>
          <Link
            href="/cover-letter"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.coverLetter.backToList}
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
          <div className="p-6 sm:p-8">
            <CoverLetterDocument
              letter={letter}
              name={user.name}
              email={user.email}
              date={todayText(locale)}
              contact={cvContact}
              labels={labels}
            />
          </div>
        </div>
      )}
    </div>
  );
}