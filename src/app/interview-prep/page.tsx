import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { isValidUuid } from "@/lib/validations/coverLetter";
import { fetchJobById } from "@/lib/jobs/public";
import { getI18n } from "@/lib/i18n/server";
import {
  PrepChecklist,
  type PrepSection,
} from "@/components/interview/prep-checklist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interview Preparation | JobEthiopia",
  description:
    "A structured, localized interview preparation checklist for candidates on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function InterviewPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const t = await getI18n();
  const ip = t.interviewPrep;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  const { job } = await searchParams;

  let jobTitle: string | null = null;
  let jobId: string | null = null;
  if (job && isValidUuid(job)) {
    try {
      const found = await fetchJobById(job);
      if (found) {
        jobTitle = found.title;
        jobId = found.id;
      }
    } catch {
      jobTitle = null;
    }
  }

  const sections: PrepSection[] = [
    { heading: ip.sections.research.heading, items: ip.sections.research.items },
    {
      heading: ip.sections.selfIntro.heading,
      items: ip.sections.selfIntro.items,
    },
    {
      heading: ip.sections.strengths.heading,
      items: ip.sections.strengths.items,
    },
    {
      heading: ip.sections.questions.heading,
      items: ip.sections.questions.items,
    },
    {
      heading: ip.sections.logistics.heading,
      items: ip.sections.logistics.items,
    },
    { heading: ip.sections.dayOf.heading, items: ip.sections.dayOf.items },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {ip.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {jobTitle ? ip.jobTitle(jobTitle) : ip.title}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {jobTitle ? ip.jobIntro(jobTitle) : ip.genericIntro}
        </p>

        {jobId && jobTitle ? (
          <Link
            href={`/jobs/${jobId}`}
            className="focus-visible:outline-2 mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {ip.jobLinkCta}
          </Link>
        ) : null}
      </header>

      <div className="mt-8">
        <PrepChecklist
          checklistId={jobId ? `job:${jobId}` : "generic"}
          sections={sections}
          labels={{
            title: ip.checklistTitle,
            hint: ip.checklistHint,
            progress: ip.progress,
            reset: ip.resetCta,
            done: ip.allDone,
          }}
        />
      </div>
    </div>
  );
}