import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { listNotifications } from "@/lib/notifications/dal";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { Pagination } from "@/components/public/pagination";
import { NotificationList } from "@/components/notifications/notification-list";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications | JobEthiopia",
  description: "Your in-app notifications.",
  robots: "noindex, nofollow",
};

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamsValue>;

function firstValue(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getI18n();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" && user.role !== "ORGANIZATION_ADMIN") {
    redirect("/jobs");
  }

  const isEmployer = user.role === "ORGANIZATION_ADMIN";

  const page = toPositiveInteger(firstValue(params.page), 1);

  let result;
  let loadError = false;
  try {
    result = await listNotifications(user.id, { page, limit: 20 });
  } catch {
    loadError = true;
  }

  const items = result?.items ?? [];
  const currentPage = result?.page ?? 1;
  const totalPages = result?.totalPages ?? 1;
  const unreadCount = result?.unreadCount ?? 0;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: t.notifications.breadcrumbHome, href: "/" },
          { label: t.notifications.breadcrumbNotifications },
        ]}
        t={t}
      />

      <header className="mt-4 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {isEmployer ? t.notifications.employerWorkspaceLabel : t.notifications.candidateWorkspaceLabel}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t.notifications.title}
            </h1>
            <p className="mt-2 text-base leading-7 text-muted">
              {t.notifications.subtitle}
            </p>
          </div>
          {unreadCount > 0 && <MarkAllReadButton t={t.notifications} />}
        </div>
      </header>

      <div className="mt-5 inline-flex flex-wrap items-center gap-2 text-sm">
        {isEmployer ? (
          <>
            <Link
              href="/organization/jobs"
              className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.notifications.viewJobs}
            </Link>
            <Link
              href="/organization/applications?status=SUBMITTED"
              className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.notifications.reviewApplications}
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/jobs"
              className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.notifications.browseJobs}
            </Link>
            <Link
              href="/applications"
              className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.notifications.myApplications}
            </Link>
          </>
        )}
      </div>

      {loadError ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
        >
          <p className="mt-4 text-muted">
            {t.notifications.loadErrorBody}
          </p>
          <Link
            href="/notifications"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.notifications.retryCta}
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div
          role="status"
          className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
        >
          <h2 className="mt-5 text-xl font-bold text-foreground">
            {t.notifications.emptyHeading}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            {t.notifications.emptyBody}
          </p>
          <Link
            href={isEmployer ? "/organization/jobs" : "/jobs"}
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isEmployer ? t.notifications.viewJobs : t.notifications.browseJobs}
          </Link>
        </div>
      ) : (
        <>
          <NotificationList
            items={items.map((n) => ({
              ...n,
              readAt: n.readAt ? n.readAt.toISOString() : null,
              createdAt: n.createdAt.toISOString(),
            }))}
            t={t.notifications}
          />

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              hrefForPage={hrefWithPage}
              t={t}
            />
          )}
        </>
      )}
    </div>
  );
}
