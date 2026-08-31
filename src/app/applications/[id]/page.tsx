import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import {
  getOwnedApplicationDetail,
  getCandidateApplicationHistory,
} from "@/lib/applications/dal";
import { ApplicationWithdraw } from "@/components/applications/withdraw-button";
import { ResumeForm } from "@/components/applications/resume-form";
import { getOwnedCandidateResume } from "@/lib/resume/dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application | JobEthiopia",
  description: "Your application details on JobEthiopia.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTime(value: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function actionLabel(action: string): string {
  switch (action) {
    case "APPLICATION_SUBMITTED":
      return "Application submitted";
    case "APPLICATION_WITHDRAWN":
      return "Application withdrawn";
    case "APPLICATION_STATUS_CHANGED":
      return "Status updated";
    default:
      return action;
  }
}

function historyDetail(
  entry: { action: string; previousStatus: string | null; newStatus: string | null },
): string | null {
  if (entry.previousStatus && entry.newStatus) {
    return `${entry.previousStatus} → ${entry.newStatus}`;
  }
  if (entry.newStatus) return entry.newStatus;
  return null;
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) {
    redirect("/jobs");
  }

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const detail = await getOwnedApplicationDetail(id, user.id);
  if (!detail) {
    notFound();
  }

  const history = await getCandidateApplicationHistory(id);
  const resume = await getOwnedCandidateResume(id, user.id);

  const canWithdraw = detail.status === "SUBMITTED" || detail.status === "REVIEWING";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/applications"
        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to My Applications
      </Link>

      <article className="mt-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{detail.jobTitle}</h1>
            <p className="mt-1 text-gray-700 dark:text-gray-200">
              {detail.organizationName ?? "Unknown organization"}
            </p>
          </div>
          <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {detail.status}
          </span>
        </header>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
            <dt className="text-gray-500 dark:text-gray-400">Submitted</dt>
            <dd className="font-semibold">{formatDateTime(detail.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
            <dt className="text-gray-500 dark:text-gray-400">Last updated</dt>
            <dd className="font-semibold">{formatDateTime(detail.updatedAt)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/jobs/${detail.jobId}`}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            View job
          </Link>
          {canWithdraw && (
            <ApplicationWithdraw applicationId={detail.id} />
          )}
        </div>

        {detail.coverLetter && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              Cover letter
            </h2>
            <p className="mt-2 whitespace-pre-line rounded-md border border-gray-200 p-4 text-sm leading-6 text-gray-700 dark:border-gray-800 dark:text-gray-200">
              {detail.coverLetter}
            </p>
          </section>
        )}

        <section className="mt-6 rounded-md border border-gray-200 p-4 dark:border-gray-800">
          <ResumeForm
            applicationId={detail.id}
            current={
              resume
                ? {
                    originalName: resume.originalName,
                    size: resume.size,
                    updatedAt: resume.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </section>
      </article>

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Application history
          </h2>
          <ul className="mt-3 space-y-3">
            {history.map((entry, index) => {
              const detailText = historyDetail(entry);
              return (
                <li
                  key={`${entry.action}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div>
                    <p className="font-semibold">{actionLabel(entry.action)}</p>
                    {detailText && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {detailText}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(entry.timestamp)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
