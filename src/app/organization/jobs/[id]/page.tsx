import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { getEmployerJob } from "@/lib/employer/jobs";
import { OrganizationNav } from "@/app/organization/nav";
import { JobStatusControls } from "./status-controls";

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  PENDING_REVIEW:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PUBLISHED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  REMOVED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function EmployerJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) redirect("/login");

  const user = await verifySession(rawToken);
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const { id } = await params;

  let job;
  try {
    job = await getEmployerJob(user.id, id);
  } catch {
    notFound();
  }

  if (!job) notFound();

  const isEditable = job.status === "DRAFT" || job.status === "PENDING_REVIEW";

  return (
    <>
      <OrganizationNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/organization/jobs"
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Jobs
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {job.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {job.organizationName}
            </p>
          </div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status] ?? ""}`}
          >
            {job.status.replace("_", " ")}
          </span>
        </div>

        {!isEditable && job.status !== "REMOVED" && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Published jobs cannot be edited by employers. Contact staff to
            request changes.
          </div>
        )}

        {job.status === "REMOVED" && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            This job has been removed.
          </div>
        )}

        <JobStatusControls jobId={job.id} status={job.status} />

        {isEditable && (
          <div className="mb-6">
            <Link
              href={`/organization/jobs/${job.id}/edit`}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit Job
            </Link>
          </div>
        )}

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
              {job.description}
            </p>
          </section>

          {job.responsibilities && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                Responsibilities
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                {job.responsibilities}
              </p>
            </section>
          )}

          {job.requirements && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                Requirements
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                {job.requirements}
              </p>
            </section>
          )}

          {job.educationRequirements && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                Education Requirements
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                {job.educationRequirements}
              </p>
            </section>
          )}

          {job.benefits && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                Benefits
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                {job.benefits}
              </p>
            </section>
          )}

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {job.categoryName && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Category
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {job.categoryName}
                </p>
              </div>
            )}
            {job.professionName && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Profession
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {job.professionName}
                </p>
              </div>
            )}
            {job.locationName && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Location
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {job.locationName}
                </p>
              </div>
            )}
            {job.employmentType && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Employment Type
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {job.employmentType.replace("_", " ")}
                </p>
              </div>
            )}
            {job.experienceMin != null && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Experience
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {job.experienceMin}
                  {job.experienceMax != null ? ` - ${job.experienceMax}` : ""}{" "}
                  years
                </p>
              </div>
            )}
            {job.salaryMin != null && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Salary
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {job.salaryMin}
                  {job.salaryMax != null ? ` - ${job.salaryMax}` : ""}
                  {job.salaryCurrency ? ` ${job.salaryCurrency}` : ""}
                  {job.salaryPeriod
                    ? ` / ${job.salaryPeriod.toLowerCase()}`
                    : ""}
                </p>
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-4">
            {job.deadline && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Deadline
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(job.deadline).toLocaleDateString()}
                </p>
              </div>
            )}
            {job.postedAt && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Posted
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(job.postedAt).toLocaleDateString()}
                </p>
              </div>
            )}
            {job.applicationUrl && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Application URL
                </h3>
                <a
                  href={job.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {job.applicationUrl}
                </a>
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div>
              Created: {new Date(job.createdAt).toLocaleString()}
            </div>
            <div>
              Updated: {new Date(job.updatedAt).toLocaleString()}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
