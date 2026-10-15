import Link from "next/link";
import type { Messages } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { PublicJobDetail } from "@/lib/jobs/public";
import { buildExperienceText, type JobPrepSkill } from "@/lib/career/prep";
import { getCurrentUser } from "@/lib/auth/context";
import { getOwnedCv } from "@/lib/cv/dal";
import { listCoverLetters } from "@/lib/coverLetter/dal";
import { getCandidateProfile } from "@/lib/candidateProfile/dal";
import { evaluateCvReadiness } from "@/lib/cv/completeness";
import { Badge } from "@/components/ui/badge";

type CareerPrepSectionProps = {
  t: Messages;
  locale: Locale;
  job: PublicJobDetail;
  skills: JobPrepSkill[];
  candidateId: string | null;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Job-specific preparation + candidate readiness panel (Phase 13).
 *
 * Shows the real skills attached to the job (from the skills taxonomy —
 * nothing is invented here), the experience and education expectations, and a
 * non-blocking readiness checklist: CV, cover letter, and interview prep.
 * The checklist never gates the apply flow; it only guides the candidate.
 */
export async function CareerPrepSection({
  t,
  job,
  skills,
  candidateId,
}: CareerPrepSectionProps) {
  const cp = t.careerPrep;
  const experienceText = buildExperienceText(
    job.experienceMin,
    job.experienceMax,
  );

  let readiness: Awaited<ReturnType<typeof evaluateCvReadiness>> | null = null;
  let hasCoverLetter = false;

  if (candidateId) {
    try {
      const user = await getCurrentUser();
      const cv = await getOwnedCv(candidateId);
      const profile = await getCandidateProfile(candidateId);
      hasCoverLetter = (await listCoverLetters(candidateId)).length > 0;
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
        accountEmail: user?.email ?? null,
        profile: profile ? { phone: profile.phone } : null,
      });
    } catch {
      readiness = null;
    }
  }

  const showCvCheck = readiness !== null;
  const cvReady = readiness?.complete ?? false;

  return (
    <section
      aria-label={cp.title}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="text-base font-semibold tracking-tight">{cp.title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{cp.subtitle}</p>

      {skills.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">{cp.skillsHeading}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill.name}>
                <Badge
                  variant={skill.isRequired ? "success" : "default"}
                  title={
                    skill.isRequired
                      ? cp.requiredSkill
                      : cp.preferredSkill
                  }
                >
                  {skill.name}
                  {skill.isRequired ? ` · ${cp.requiredSkill}` : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {experienceText ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">{t.jobs.experience}</dt>
            <dd className="text-right font-medium text-foreground">
              {experienceText}
            </dd>
          </div>
        </dl>
      ) : null}

      {job.educationRequirements ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          <span className="font-semibold text-foreground">
            {t.jobs.qualifications}:
          </span>{" "}
          {job.educationRequirements}
        </p>
      ) : null}

      {candidateId ? (
        <div className="mt-5 space-y-3 border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{cp.cvChecklist}</span>
            {showCvCheck ? (
              cvReady ? (
                <Badge variant="success">
                  <CheckIcon className="h-3.5 w-3.5" />
                  {cp.ready}
                </Badge>
              ) : (
                <Link
                  href="/cv/edit"
                  className="text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {cp.finishCv}
                </Link>
              )
            ) : (
              <Link
                href="/cv/edit"
                className="text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {cp.createCv}
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{cp.coverLetterChecklist}</span>
            {hasCoverLetter ? (
              <Badge variant="success">
                <CheckIcon className="h-3.5 w-3.5" />
                {cp.ready}
              </Badge>
            ) : (
              <Link
                href={`/cover-letter/create?job=${job.id}`}
                className="text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {cp.writeCoverLetter}
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{cp.interviewChecklist}</span>
            <Link
              href={`/interview-prep?job=${job.id}`}
              className="text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {cp.prepareInterview}
            </Link>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-subtle">{cp.notGuaranteeHint}</p>
    </section>
  );
}