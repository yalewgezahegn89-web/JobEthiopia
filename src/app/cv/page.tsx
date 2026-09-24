import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { getOwnedCv } from "@/lib/cv/dal";
import { evaluateCvReadiness } from "@/lib/cv/completeness";
import { getCandidateProfile } from "@/lib/candidateProfile/dal";
import { CvDocument, type CvDocumentLabels } from "@/components/cv/cv-document";
import { CvDeleteButton } from "@/components/cv/cv-delete-button";
import { CvReadinessCard } from "@/components/cv/cv-readiness-card";
import { getI18n, getCurrentLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My CV | JobEthiopia",
  description: "Create and manage your career CV on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function CvDashboardPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  let cv = null;
  let loadError = false;
  let profile: Awaited<ReturnType<typeof getCandidateProfile>> = null;
  try {
    cv = await getOwnedCv(user.id);
    profile = await getCandidateProfile(user.id);
  } catch {
    loadError = true;
  }

  let readiness: Awaited<ReturnType<typeof evaluateCvReadiness>> | null = null;
  if (!loadError) {
    readiness = evaluateCvReadiness({
      hasCv: cv !== null,
      cv: cv
        ? {
            header: {
              phone: cv.header.phone,
              location: cv.header.location,
              professionalSummary: cv.header.professionalSummary,
            },
            experiences: cv.experiences,
            educations: cv.educations,
            skills: cv.skills,
            certifications: cv.certifications,
          }
        : null,
      accountEmail: user.email,
      profile: profile ? { phone: profile.phone } : null,
    });
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.cv.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.cv.title}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t.cv.subtitle}
        </p>
      </header>

      {!loadError && readiness ? (
        <div className="mt-6">
          <CvReadinessCard
            t={t}
            percent={readiness.percent}
            complete={readiness.complete}
            missing={readiness.missing}
            hasCv={cv !== null}
          />
        </div>
      ) : null}

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="text-muted">
            {t.cv.messages.genericError}
          </p>
          <Link
            href="/cv"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.common.tryAgain}
          </Link>
        </div>
      ) : cv === null ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
        >
          <h2 className="text-xl font-bold text-foreground">{t.cv.noCvHeading}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            {t.cv.noCvBody}
          </p>
          <Link
            href="/cv/edit"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.cv.createCta}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 print-hide">
            <Link
              href="/cv/edit"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.cv.openEdit}
            </Link>
            <Link
              href="/cv/preview"
              className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.cv.openPreview}
            </Link>
            <span className="ml-auto text-sm text-muted">{t.cv.savedStatus}</span>
          </div>

          <div className="mt-6">
            <CvDocument name={user.name} email={user.email} cv={cv} labels={labels} locale={locale} />
          </div>

          <div className="mt-8 border-t border-border-subtle pt-6 print-hide">
            <CvDeleteButton />
            <p className="mt-2 text-xs text-subtle">{t.cv.deleteHint}</p>
          </div>
        </>
      )}
    </div>
  );
}