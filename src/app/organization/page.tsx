import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql, lte, gte } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { applications } from "@/db/schema/applications";
import { organizations } from "@/db/schema/organizations";
import { getCurrentUser } from "@/lib/auth/context";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ArrowRightIcon,
  PlusIcon,
  UserIcon,
} from "@/components/public/icons";
import { EmptyState } from "@/components/public/empty-state";

export const dynamic = "force-dynamic";

type JobStatusCounts = {
  PUBLISHED: number;
  DRAFT: number;
  PENDING_REVIEW: number;
};

type ApplicationStatusCounts = {
  SUBMITTED: number;
  REVIEWING: number;
  SHORTLISTED: number;
  total: number;
};

type DeadlineRow = {
  id: string;
  title: string;
  organizationName: string;
  deadline: Date;
};

function deadlineLabel(deadline: Date, now: Date): string {
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}

export default async function OrganizationDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const orgIds = await getUserOrganizationIds(user.id);
  if (orgIds.length === 0) {
    return (
      <EmptyState
        icon={<BuildingIcon className="h-7 w-7" />}
        heading="Dashboard"
        body="No organizations yet."
      />
    );
  }

  const jobCounts: JobStatusCounts = { PUBLISHED: 0, DRAFT: 0, PENDING_REVIEW: 0 };
  const appCounts: ApplicationStatusCounts = { SUBMITTED: 0, REVIEWING: 0, SHORTLISTED: 0, total: 0 };
  let deadlines: DeadlineRow[] = [];

  let activeOrgIds: string[];
  try {
    activeOrgIds = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(organizations.status, "ACTIVE"),
        ),
      )
      .then((rows) => rows.map((r) => r.id));
  } catch {
    return (
      <EmptyState
        icon={<BuildingIcon className="h-7 w-7" />}
        heading="Dashboard"
        body="We could not load the dashboard right now. Please try again shortly."
      />
    );
  }

  if (activeOrgIds.length === 0) {
    return (
      <EmptyState
        icon={<BuildingIcon className="h-7 w-7" />}
        heading="Dashboard"
        body="No active organizations."
      />
    );
  }

  try {
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [jobRows, appRows, deadlineRows] = await Promise.all([
      db
        .select({
          status: jobs.status,
          count: sql<number>`count(*)::int`,
        })
        .from(jobs)
        .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
        .where(
          and(
            inArray(jobs.organizationId, activeOrgIds),
            eq(organizations.status, "ACTIVE"),
            inArray(jobs.status, ["PUBLISHED", "DRAFT", "PENDING_REVIEW"]),
          ),
        )
        .groupBy(jobs.status),
      db
        .select({
          status: applications.status,
          count: sql<number>`count(*)::int`,
        })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
        .where(
          and(
            inArray(jobs.organizationId, activeOrgIds),
            eq(organizations.status, "ACTIVE"),
          ),
        )
        .groupBy(applications.status),
      db
        .select({
          id: jobs.id,
          title: jobs.title,
          organizationName: organizations.name,
          deadline: jobs.deadline,
        })
        .from(jobs)
        .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
        .where(
          and(
            inArray(jobs.organizationId, activeOrgIds),
            eq(organizations.status, "ACTIVE"),
            eq(jobs.status, "PUBLISHED"),
            gte(jobs.deadline, now),
            lte(jobs.deadline, sevenDaysOut),
          ),
        )
        .orderBy(jobs.deadline)
        .limit(5),
    ]);

    for (const row of jobRows) {
      const s = row.status as keyof JobStatusCounts;
      if (s in jobCounts) jobCounts[s] = row.count;
    }

    let totalApps = 0;
    for (const row of appRows) {
      totalApps += row.count;
      if (row.status === "SUBMITTED") appCounts.SUBMITTED = row.count;
      if (row.status === "REVIEWING") appCounts.REVIEWING = row.count;
      if (row.status === "SHORTLISTED") appCounts.SHORTLISTED = row.count;
    }
    appCounts.total = totalApps;

    deadlines = deadlineRows.map((r) => ({
      id: r.id,
      title: r.title,
      organizationName: r.organizationName,
      deadline: r.deadline as Date,
    }));

    const overdueRows = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        organizationName: organizations.name,
        deadline: jobs.deadline,
      })
      .from(jobs)
      .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
      .where(
        and(
          inArray(jobs.organizationId, activeOrgIds),
          eq(organizations.status, "ACTIVE"),
          eq(jobs.status, "PUBLISHED"),
          lte(jobs.deadline, now),
        ),
      )
      .orderBy(jobs.deadline)
      .limit(5);

    for (const row of overdueRows) {
      if (!deadlines.find((d) => d.id === row.id)) {
        deadlines.push({
          id: row.id,
          title: row.title,
          organizationName: row.organizationName,
          deadline: row.deadline as Date,
        });
      }
    }

    deadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    deadlines = deadlines.slice(0, 5);
  } catch {
    return (
      <EmptyState
        icon={<BriefcaseIcon className="h-7 w-7" />}
        heading="Dashboard"
        body="We could not load the dashboard right now. Please try again shortly."
      />
    );
  }

  const now = new Date();

  const kpiCards = [
    {
      label: "Published Jobs",
      value: jobCounts.PUBLISHED,
      href: "/organization/jobs?status=PUBLISHED",
      tone: "text-success",
      icon: BriefcaseIcon,
      light: "bg-success-light",
    },
    {
      label: "Drafts",
      value: jobCounts.DRAFT,
      href: "/organization/jobs?status=DRAFT",
      tone: "text-muted",
      icon: BriefcaseIcon,
      light: "bg-surface-raised",
    },
    {
      label: "Pending Review",
      value: jobCounts.PENDING_REVIEW,
      href: "/organization/jobs?status=PENDING_REVIEW",
      tone: "text-warning",
      icon: BriefcaseIcon,
      light: "bg-warning-light",
    },
    {
      label: "Applications to Review",
      value: appCounts.SUBMITTED,
      href: "/organization/applications?status=SUBMITTED",
      tone: "text-primary",
      icon: UserIcon,
      light: "bg-primary-light",
    },
    {
      label: "In Review",
      value: appCounts.REVIEWING,
      href: "/organization/applications?status=REVIEWING",
      tone: "text-warning",
      icon: UserIcon,
      light: "bg-warning-light",
    },
    {
      label: "Shortlisted",
      value: appCounts.SHORTLISTED,
      href: "/organization/applications?status=SHORTLISTED",
      tone: "text-success",
      icon: UserIcon,
      light: "bg-success-light",
    },
    {
      label: "Total Applications",
      value: appCounts.total,
      href: "/organization/applications",
      tone: "text-foreground",
      icon: UserIcon,
      light: "bg-surface-raised",
    },
  ];

  const quickActions = [
    {
      label: "Create Job",
      description: "Post a new role",
      href: "/organization/jobs/create",
      primary: true,
    },
    {
      label: "View Jobs",
      description: "Manage your listings",
      href: "/organization/jobs",
    },
    {
      label: "Review Applications",
      description: "Candidates to action",
      href: "/organization/applications?status=SUBMITTED",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Employer workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Overview of your organizations, jobs, and applications.
          </p>
        </div>
        <Link
          href="/organization/jobs/create"
          className="focus-visible:outline-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <PlusIcon className="h-4 w-4" />
          Create Job
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-3xl font-bold tracking-tight ${card.tone}`}>
                    {card.value}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-muted">
                    {card.label}
                  </p>
                </div>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.light} ${card.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <section aria-labelledby="quick-actions-heading" className="mt-10">
        <h2
          id="quick-actions-heading"
          className="text-sm font-semibold uppercase tracking-wider text-subtle"
        >
          Quick actions
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`group flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                action.primary
                  ? "border-transparent bg-primary text-white hover:bg-primary-hover"
                  : "border-border bg-surface"
              }`}
            >
              <span>
                <span
                  className={`block text-sm font-semibold ${
                    action.primary ? "text-white" : "text-foreground"
                  }`}
                >
                  {action.label}
                </span>
                <span
                  className={`block text-xs ${
                    action.primary ? "text-white/80" : "text-muted"
                  }`}
                >
                  {action.description}
                </span>
              </span>
              <ArrowRightIcon
                className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
                  action.primary ? "text-white" : "text-subtle"
                }`}
              />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="deadlines-heading" className="mt-10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2
            id="deadlines-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Upcoming deadlines
          </h2>
        </div>

        {deadlines.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No upcoming deadlines.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {deadlines.map((d) => {
              const isOverdue = d.deadline.getTime() < now.getTime();
              const label = deadlineLabel(d.deadline, now);
              return (
                <li
                  key={d.id}
                  className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-shadow hover:shadow-md ${
                    isOverdue
                      ? "border-destructive-light bg-destructive-light/40"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/organization/jobs/${d.id}`}
                      className="focus-visible:outline-2 block truncate text-sm font-semibold text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary hover:text-primary"
                    >
                      {d.title}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {d.organizationName}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isOverdue
                        ? "bg-destructive-light text-destructive"
                        : "bg-warning-light text-warning"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
