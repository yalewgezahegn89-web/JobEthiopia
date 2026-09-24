import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { getOwnedCoverLetter } from "@/lib/coverLetter/dal";
import { getI18n } from "@/lib/i18n/server";
import { CoverLetterForm } from "@/components/cover-letter/cover-letter-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Cover Letter | JobEthiopia",
  description: "Edit your cover letter on JobEthiopia.",
  robots: "noindex, nofollow",
};

export default async function CoverLetterEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getI18n();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  const { id } = await params;

  let letter: Awaited<ReturnType<typeof getOwnedCoverLetter>> = null;
  let loadError = false;
  try {
    letter = await getOwnedCoverLetter(user.id, id);
  } catch {
    loadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.coverLetter.eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.coverLetter.editTitle}
        </h1>
        <Link
          href={letter ? `/cover-letter/${letter.id}` : "/cover-letter"}
          className="focus-visible:outline-2 mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.coverLetter.backToList}
        </Link>
      </header>

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
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
          <div className="p-6 sm:p-8">
            <CoverLetterForm
              existing={{
                id: letter.id,
                jobId: letter.jobId,
                title: letter.title,
                position: letter.position,
                employer: letter.employer,
                recipient: letter.recipient,
                location: letter.location,
                body: letter.body,
              }}
              prefill={null}
            />
          </div>
        </div>
      )}
    </div>
  );
}