import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql, lte, gte } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { applications } from "@/db/schema/applications";
import { organizations } from "@/db/schema/organizations";
import { getCurrentUser } from "@/lib/auth/context";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import { OrganizationNav } from "./nav";

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
      <>
        <OrganizationNav />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No organizations
          </p>
        </main>
      </>
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
      <>
        <OrganizationNav />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-sm text-red-600">
            We could not load the dashboard right now. Please try again shortly.
          </p>
        </main>
      </>
    );
  }

  if (activeOrgIds.length === 0) {
    return (
      <>
        <OrganizationNav />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No active organizations
          </p>
        </main>
      </>
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
      <>
        <OrganizationNav />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-sm text-red-600">
            We could not load the dashboard right now. Please try again shortly.
          </p>
        </main>
      </>
    );
  }

  const now = new Date();

  const kpiCards = [
    {
      label: "Published Jobs",
      value: jobCounts.PUBLISHED,
      href: "/organization/jobs?status=PUBLISHED",
      color: "bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    {
      label: "Drafts",
      value: jobCounts.DRAFT,
      href: "/organization/jobs?status=DRAFT",
      color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    },
    {
      label: "Pending Review",
      value: jobCounts.PENDING_REVIEW,
      href: "/organization/jobs?status=PENDING_REVIEW",
      color:
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    },
    {
      label: "Applications to Review",
      value: appCounts.SUBMITTED,
      href: "/organization/applications?status=SUBMITTED",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    {
      label: "Shortlisted",
      value: appCounts.SHORTLISTED,
      href: "/organization/applications?status=SHORTLISTED",
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
    {
      label: "In Review",
      value: appCounts.REVIEWING,
      href: "/organization/applications?status=REVIEWING",
      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    {
      label: "Total Applications",
      value: appCounts.total,
      href: "/organization/applications",
      color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    },
  ];

  return (
    <>
      <OrganizationNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your organizations, jobs, and applications.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {kpiCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-lg p-4 ${card.color}`}
            >
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-1 text-sm">{card.label}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick Actions
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/organization/jobs/create"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Job
            </Link>
            <Link
              href="/organization/jobs"
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              View Jobs
            </Link>
            <Link
              href="/organization/applications?status=SUBMITTED"
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Review Applications
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Upcoming Deadlines
          </h2>
          {deadlines.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No upcoming deadlines.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {deadlines.map((d) => {
                const isOverdue = d.deadline.getTime() < now.getTime();
                const label = deadlineLabel(d.deadline, now);
                return (
                  <li
                    key={d.id}
                    className={`flex items-center justify-between rounded border p-3 text-sm ${
                      isOverdue
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                        : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                    }`}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/organization/jobs/${d.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {d.title}
                      </Link>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {d.organizationName}
                      </span>
                    </div>
                    <span
                      className={`ml-4 shrink-0 text-xs font-medium ${
                        isOverdue
                          ? "text-red-700 dark:text-red-300"
                          : "text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
