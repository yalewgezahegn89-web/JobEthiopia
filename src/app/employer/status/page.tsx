import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { employerOnboardingRequests } from "@/db/schema/employerOnboardingRequests";
import { getCurrentUser } from "@/lib/auth/context";
import { getI18n } from "@/lib/i18n/server";
import { EmployerResubmitForm } from "./resubmit-form";

export const metadata: Metadata = {
  title: "Employer request status",
};

export default async function EmployerStatusPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const t = await getI18n();

  let request;
  let loadError = false;
  try {
    request = await db.query.employerOnboardingRequests.findFirst({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: [desc(employerOnboardingRequests.createdAt)],
    });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold text-foreground">{t.employerAuth.statusHeading}</h1>
        <p className="max-w-md text-center text-muted">
          {t.employerAuth.statusLoadError}
        </p>
        <Link href="/" className="text-sm text-muted underline">
          {t.employerAuth.statusBack}
        </Link>
      </section>
    );
  }

  if (!request) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold text-foreground">{t.employerAuth.statusNoRequest}</h1>
        <p className="max-w-md text-center text-muted">
          {t.employerAuth.statusNoRequestBody}
        </p>
        <Link
          href="/employer/register"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.employerAuth.statusRequestCta}
        </Link>
      </section>
    );
  }

  if (request.status === "APPROVED") {
    redirect("/organization");
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold text-foreground">{t.employerAuth.statusTitle}</h1>
      {request.status === "PENDING" ? (
        <>
          <p className="max-w-md text-center text-muted">
            {t.employerAuth.statusPendingBody(request.organizationName)}
          </p>
          <span className="rounded-full bg-warning-light px-3 py-1 text-sm font-semibold text-warning">
            {t.employerAuth.statusPendingLabel}
          </span>
        </>
      ) : (
        <>
          <p className="max-w-md text-center text-muted">
            {t.employerAuth.statusRejectedBody}
          </p>

          {request.reviewNotes ? (
            <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-left">
              <h2 className="text-sm font-semibold text-foreground">
                {t.employerAuth.statusRejectedReasonLabel}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {request.reviewNotes}
              </p>
            </div>
          ) : null}

          <div className="w-full max-w-md">
            <h2 className="text-center text-base font-semibold tracking-tight text-foreground">
              {t.employerAuth.resubmitHeading}
            </h2>
            <p className="mt-1 text-center text-sm text-muted">
              {t.employerAuth.resubmitBody}
            </p>
            <div className="mt-4 flex justify-center">
              <EmployerResubmitForm t={t} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
