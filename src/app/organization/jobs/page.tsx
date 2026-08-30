import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { listEmployerJobs } from "@/lib/employer/jobs";
import { OrganizationNav } from "@/app/organization/nav";

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  PENDING_REVIEW:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PUBLISHED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  REMOVED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function EmployerJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) redirect("/login");

  const user = await verifySession(rawToken);
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const params = await searchParams;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const pageParam = typeof params.page === "string" ? params.page : undefined;

  const validStatuses = [
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "EXPIRED",
    "REMOVED",
  ];
  const status = validStatuses.includes(statusParam ?? "")
    ? (statusParam as "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED")
    : undefined;
  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;

  let result;
  try {
    result = await listEmployerJobs(user.id, { status, page, limit: 20 });
  } catch {
    return (
      <>
        <OrganizationNav />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-sm text-red-600">
            Unable to load jobs. Please try again.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <OrganizationNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Jobs
          </h1>
          <Link
            href="/organization/jobs/create"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Job
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          <Link
            href="/organization/jobs"
            className={`rounded px-3 py-1 text-sm ${
              !status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            All
          </Link>
          {validStatuses.map((s) => (
            <Link
              key={s}
              href={`/organization/jobs?status=${s}`}
              className={`rounded px-3 py-1 text-sm ${
                status === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {s.replace("_", " ")}
            </Link>
          ))}
        </div>

        {result.items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No jobs found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Title
                  </th>
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Organization
                  </th>
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Applications
                  </th>
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Deadline
                  </th>
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Created
                  </th>
                  <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-gray-100 dark:border-gray-900"
                  >
                    <td className="py-3">
                      <Link
                        href={`/organization/jobs/${job.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {job.organizationName}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status] ?? ""}`}
                      >
                        {job.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      <span className="text-sm">{job.applicationCount}</span>
                      {job.needsReviewCount > 0 && (
                        <span className="ml-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          {job.needsReviewCount} to review
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {job.deadline
                        ? new Date(job.deadline).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/organization/jobs/${job.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                        {(job.status === "DRAFT" ||
                          job.status === "PENDING_REVIEW") && (
                          <Link
                            href={`/organization/jobs/${job.id}/edit`}
                            className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {result.page > 1 && (
              <Link
                href={`/organization/jobs?page=${result.page - 1}${status ? `&status=${status}` : ""}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Previous
              </Link>
            )}
            <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
              Page {result.page} of {result.totalPages}
            </span>
            {result.page < result.totalPages && (
              <Link
                href={`/organization/jobs?page=${result.page + 1}${status ? `&status=${status}` : ""}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
