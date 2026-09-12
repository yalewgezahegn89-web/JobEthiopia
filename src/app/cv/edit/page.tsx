import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { getOwnedCv } from "@/lib/cv/dal";
import { CvForm, type CvFormInitial } from "@/components/cv/cv-form";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit CV | JobEthiopia",
  description: "Edit your career CV on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function CvEditPage() {
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

  const initial: CvFormInitial = cv
    ? {
        title: cv.header.title,
        professionalSummary: cv.header.professionalSummary ?? "",
        phone: cv.header.phone ?? "",
        location: cv.header.location ?? "",
        websiteUrl: cv.header.websiteUrl ?? "",
        experiences: cv.experiences.map((e) => ({
          id: e.id,
          employer: e.employer ?? "",
          role: e.role ?? "",
          location: e.location ?? "",
          startMonth: e.startMonth ?? "",
          endMonth: e.endMonth ?? "",
          description: e.description ?? "",
        })),
        educations: cv.educations.map((e) => ({
          id: e.id,
          institution: e.institution ?? "",
          qualification: e.qualification ?? "",
          fieldOfStudy: e.fieldOfStudy ?? "",
          startMonth: e.startMonth ?? "",
          endMonth: e.endMonth ?? "",
        })),
        skills: cv.skills.map((s) => ({ id: s.id, name: s.name ?? "", level: s.level ?? "" })),
        certifications: cv.certifications.map((c) => ({
          id: c.id,
          name: c.name ?? "",
          issuer: c.issuer ?? "",
          issuedMonth: c.issuedMonth ?? "",
          credentialUrl: c.credentialUrl ?? "",
        })),
      }
    : {
        title: "",
        professionalSummary: "",
        phone: "",
        location: "",
        websiteUrl: "",
        experiences: [],
        educations: [],
        skills: [],
        certifications: [],
      };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.cv.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.cv.editTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t.cv.editSubtitle}
        </p>
        <Link
          href="/cv"
          className="focus-visible:outline-2 mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-sm font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.cv.backToCv}
        </Link>
      </header>

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="text-muted">{t.cv.messages.genericError}</p>
          <Link
            href="/cv/edit"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.common.tryAgain}
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
          <div className="p-6 sm:p-8">
            <CvForm initial={initial} />
          </div>
        </div>
      )}
    </div>
  );
}