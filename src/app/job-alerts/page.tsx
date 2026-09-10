import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { listAlertsForUser, type JobAlertRow } from "@/lib/jobAlerts/dal";
import { fetchCategories } from "@/lib/categories/public";
import { fetchProfessions } from "@/lib/professions/public";
import { fetchLocations } from "@/lib/locations/public";
import { getI18n, getCurrentLocale } from "@/lib/i18n/server";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { JobAlertForm } from "@/components/job-alerts/job-alert-form";
import { JobAlertList } from "@/components/job-alerts/job-alert-list";
import { BriefcaseIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job Alerts | JobEthiopia",
  description:
    "Manage your JobEthiopia alerts and get notified when new jobs match your criteria.",
  robots: "noindex, nofollow",
};

export default async function JobAlertsPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect("/jobs");

  let alerts: JobAlertRow[];
  let loadError = false;
  try {
    alerts = await listAlertsForUser(user.id);
  } catch {
    loadError = true;
    alerts = [];
  }

  let optionCategories: { id: string; name: string }[] = [];
  let optionProfessions: { id: string; name: string }[] = [];
  let optionLocations: { id: string; name: string }[] = [];
  try {
    const [categories, professions, locations] = await Promise.all([
      fetchCategories({ limit: 200, isActive: true }).catch(() => null),
      fetchProfessions({ limit: 200, isActive: true }).catch(() => null),
      fetchLocations({ limit: 200, isActive: true }).catch(() => null),
    ]);
    optionCategories = categories?.items.map((c) => ({ id: c.id, name: c.name })) ?? [];
    optionProfessions = professions?.items.map((p) => ({ id: p.id, name: p.name })) ?? [];
    optionLocations = locations?.items.map((l) => ({ id: l.id, name: l.name })) ?? [];
  } catch {
    // Options degrade to empty — the form still works for keywords + frequency.
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: t.nav.jobAlerts }]}
        t={t}
      />

      <header className="mt-4 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Candidate workspace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Job Alerts
        </h1>
        <p className="mt-2 text-base leading-7 text-muted">
          Get notified when new jobs match your criteria.
        </p>
      </header>

      <div className="mt-5 inline-flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Browse jobs
        </Link>
        <Link
          href="/saved-jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Saved Jobs
        </Link>
      </div>

      <JobAlertForm
        categories={optionCategories}
        professions={optionProfessions}
        locations={optionLocations}
        locale={locale}
      />

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
            <BriefcaseIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-muted">
            We could not load your job alerts right now. Please try again
            shortly.
          </p>
          <Link
            href="/job-alerts"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Retry
          </Link>
        </div>
      ) : (
        <JobAlertList items={alerts} />
      )}
    </div>
  );
}