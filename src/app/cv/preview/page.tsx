import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { getOwnedCv } from "@/lib/cv/dal";
import { recordCvPreviewAction } from "@/app/cv/actions";
import { CvDocument, type CvDocumentLabels } from "@/components/cv/cv-document";
import { PreviewToolbar } from "@/components/cv/preview-toolbar";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CV Preview | JobEthiopia",
  description: "Preview your CV for printing on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function CvPreviewPage() {
  const t = await getI18n();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  let cv = null;
  let loadError = false;
  try {
    cv = await getOwnedCv(user.id);
  } catch {
    loadError = true;
  }

  // best-effort analytics on page load; swallowed by action implementation
  if (cv) {
    void recordCvPreviewAction();
  }

  const labels: CvDocumentLabels = {
    summary: t.cv.preview.summaryLabel,
    experience: t.cv.preview.experienceLabel,
    education: t.cv.preview.educationLabel,
    skills: t.cv.preview.skillsLabel,
    certifications: t.cv.preview.certificationsLabel,
    phone: t.cv.preview.phoneLabel,
    location: t.cv.preview.locationLabel,
    website: t.cv.preview.websiteLabel,
    present: t.cv.preview.present,
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header className="print-hide">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.cv.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.cv.previewTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t.cv.previewSubtitle}
        </p>
      </header>

      <div className="print-hide mt-6">
        <PreviewToolbar />
      </div>

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="text-muted">{t.cv.messages.genericError}</p>
          <Link
            href="/cv/preview"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.common.tryAgain}
          </Link>
        </div>
      ) : cv === null ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="text-muted">{t.cv.messages.notFound}</p>
          <Link
            href="/cv/edit"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.cv.createCta}
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
          <div className="p-6 sm:p-8">
            <CvDocument name={user.name} email={user.email} cv={cv} labels={labels} />
          </div>
        </div>
      )}
    </div>
  );
}