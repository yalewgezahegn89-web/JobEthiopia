import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { isValidUuid } from "@/lib/validations/coverLetter";
import { fetchJobById } from "@/lib/jobs/public";
import { getI18n } from "@/lib/i18n/server";
import {
  CoverLetterForm,
  type CoverLetterPrefill,
} from "@/components/cover-letter/cover-letter-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Cover Letter | JobEthiopia",
  description: "Create a new cover letter on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function CoverLetterCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const t = await getI18n();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  const { job } = await searchParams;

  let prefill: CoverLetterPrefill | null = null;
  if (job && isValidUuid(job)) {
    try {
      const found = await fetchJobById(job);
      if (found && found.status === "PUBLISHED") {
        prefill = {
          jobId: found.id,
          position: found.title,
          employer: found.organizationName ?? "",
          location: found.locationName,
        };
      }
    } catch {
      prefill = null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.coverLetter.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.coverLetter.newTitle}
        </h1>
        <Link
          href="/cover-letter"
          className="focus-visible:outline-2 mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.coverLetter.backToList}
        </Link>
      </header>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6 sm:p-8">
          <CoverLetterForm existing={null} prefill={prefill} />
        </div>
      </div>
    </div>
  );
}