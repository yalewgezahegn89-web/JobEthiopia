import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import {
  getEmployerApplication,
  getEmployerApplicationStatusHistory,
} from "@/lib/employer/applications";
import { getEmployerApplicationResume } from "@/lib/resume/dal";
import { listApplicationNotes } from "@/lib/employer/applicationNotes";
import { NotesSection } from "@/components/employer/notes-section";
import { StatusForm } from "./status-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application Detail | JobEthiopia Employer",
};

function historyActionLabel(action: string, prev: string | null, next: string | null): string {
  if (action === "APPLICATION_SUBMITTED") return "Application submitted";
  if (action === "APPLICATION_WITHDRAWN") return "Application withdrawn";
  if (action === "APPLICATION_STATUS_CHANGED" && prev && next) {
    return `Status changed: ${prev} → ${next}`;
  }
  return action;
}

export default async function EmployerApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const { id } = await params;

  let detail;
  let history;
  let resume;
  let notes: {
    id: string;
    authorUserId: string | null;
    authorName: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
  }[] = [];
  try {
    [detail, history, resume] = await Promise.all([
      getEmployerApplication(user.id, id),
      getEmployerApplicationStatusHistory(user.id, id),
      getEmployerApplicationResume(id, user.id),
    ]);
    const notesResult = await listApplicationNotes(user.id, id);
    if (notesResult.ok) {
      notes = notesResult.item.map((n) => ({
        id: n.id,
        authorUserId: n.authorUserId,
        authorName: n.authorName,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }));
    }
  } catch {
    notFound();
  }

  if (!detail) notFound();

  const statusColors: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    WITHDRAWN: "bg-gray-100 text-gray-600",
    REVIEWING: "bg-yellow-100 text-yellow-800",
    SHORTLISTED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <Link
        href="/organization/applications"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to applications
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {detail.jobTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {detail.organizationName}
            </p>
          </div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[detail.status] ?? "bg-gray-100 text-gray-600"}`}
          >
            {detail.status}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Candidate</h2>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {detail.candidateName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {detail.candidateEmail}
            </p>

            {(detail.candidatePhone ||
              detail.candidateLocationName ||
              detail.candidateTotalExperienceYears != null ||
              detail.candidateEducation) && (
              <dl className="mt-3 space-y-1 text-sm">
                {detail.candidatePhone && (
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-gray-500">Phone</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {detail.candidatePhone}
                    </dd>
                  </div>
                )}
                {detail.candidateLocationName && (
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-gray-500">Location</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {detail.candidateLocationName}
                    </dd>
                  </div>
                )}
                {detail.candidateTotalExperienceYears != null && (
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-gray-500">Experience</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {detail.candidateTotalExperienceYears} year
                      {detail.candidateTotalExperienceYears === 1 ? "" : "s"}
                    </dd>
                  </div>
                )}
                {detail.candidateEducation && (
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-gray-500">Education</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {detail.candidateEducation}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {detail.candidateProfessionalSummary && (
              <div className="mt-3">
                <h3 className="text-sm font-medium text-gray-500">
                  Professional summary
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                  {detail.candidateProfessionalSummary}
                </p>
              </div>
            )}

            {resume && (
              <div className="mt-3">
                <h3 className="text-sm font-medium text-gray-500">Resume</h3>
                <div className="mt-1 flex items-center gap-3 text-sm">
                  <span className="text-gray-900 dark:text-gray-100">
                    {resume.originalName}
                  </span>
                  <a
                    href={`/api/applications/${detail.id}/resume`}
                    download
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Download
                  </a>
                </div>
              </div>
            )}
          </div>

          {detail.coverLetter && (
            <div>
              <h2 className="text-sm font-medium text-gray-500">Cover Letter</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                {detail.coverLetter}
              </p>
            </div>
          )}

          <div className="flex gap-6 text-xs text-gray-500">
            <div>Submitted: {new Date(detail.createdAt).toLocaleString()}</div>
            <div>Updated: {new Date(detail.updatedAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-6">
          <StatusForm
            applicationId={detail.id}
            currentStatus={detail.status}
          />
        </div>
      </div>

      <div className="mt-6">
        <NotesSection
          applicationId={detail.id}
          notes={notes}
          currentUserId={user.id}
        />
      </div>

      {history.length > 0 && (
        <div className="mt-6 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status History
          </h2>
          <ul className="mt-3 space-y-3">
            {history.map((entry, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-gray-100">
                    {historyActionLabel(entry.action, entry.previousStatus, entry.newStatus)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
