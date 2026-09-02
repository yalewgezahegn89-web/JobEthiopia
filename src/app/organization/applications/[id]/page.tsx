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
import { Badge } from "@/components/ui/badge";
import { APPLICATION_STATUS_META } from "@/components/applications/status-badge";
import {
  UserIcon,
  BuildingIcon,
  PinIcon,
  CalendarIcon,
  BriefcaseIcon,
  DownloadIcon,
  FileIcon,
} from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application Detail | JobEthiopia Employer",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "info"
> = {
  SUBMITTED: "info",
  WITHDRAWN: "default",
  REVIEWING: "warning",
  SHORTLISTED: "success",
  REJECTED: "destructive",
};

function historyActionLabel(
  action: string,
  prev: string | null,
  next: string | null,
): string {
  if (action === "APPLICATION_SUBMITTED") return "Application submitted";
  if (action === "APPLICATION_WITHDRAWN") return "Application withdrawn";
  if (action === "APPLICATION_STATUS_CHANGED" && prev && next) {
    return `Status changed: ${prev} → ${next}`;
  }
  return action;
}

function MetaRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number | null;
  icon?: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-subtle">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
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

  return (
    <div>
      <Link
        href="/organization/applications"
        className="focus-visible:outline-2 inline-flex items-center gap-2 text-sm font-medium text-primary focus-visible:outline-offset-2 focus-visible:outline-primary hover:underline"
      >
        <span aria-hidden="true">←</span> Back to applications
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm text-muted">
                <BuildingIcon className="h-4 w-4 text-subtle" />
                {detail.organizationName}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {detail.jobTitle}
              </h1>
            </div>
            <Badge
              variant={STATUS_VARIANT[detail.status] ?? "default"}
              className="shrink-0 text-sm"
            >
              {APPLICATION_STATUS_META[detail.status as keyof typeof APPLICATION_STATUS_META]?.label ?? detail.status}
            </Badge>
          </div>

          <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaRow
              label="Candidate"
              value={detail.candidateName}
              icon={<UserIcon className="h-4 w-4" />}
            />
            <MetaRow label="Email" value={detail.candidateEmail} />
            <MetaRow
              label="Phone"
              value={detail.candidatePhone}
              icon={<UserIcon className="h-4 w-4" />}
            />
            <MetaRow
              label="Location"
              value={detail.candidateLocationName}
              icon={<PinIcon className="h-4 w-4" />}
            />
            <MetaRow
              label="Experience"
              value={
                detail.candidateTotalExperienceYears != null
                  ? `${detail.candidateTotalExperienceYears} year${detail.candidateTotalExperienceYears === 1 ? "" : "s"}`
                  : null
              }
            />
            <MetaRow
              label="Education"
              value={detail.candidateEducation}
              icon={<BriefcaseIcon className="h-4 w-4" />}
            />
          </div>

          {resume && (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <FileIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {resume.originalName}
                  </p>
                  <p className="text-xs text-muted">Resume</p>
                </div>
              </div>
              <a
                href={`/api/applications/${detail.id}/resume`}
                download
                className="focus-visible:outline-2 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <DownloadIcon className="h-4 w-4" />
                Download
              </a>
            </div>
          )}

          {detail.candidateProfessionalSummary && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">
                Professional summary
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                {detail.candidateProfessionalSummary}
              </p>
            </div>
          )}

          {detail.coverLetter && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">
                Cover letter
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                {detail.coverLetter}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Submitted: {new Date(detail.createdAt).toLocaleString()}
            </span>
            <span>Updated: {new Date(detail.updatedAt).toLocaleString()}</span>
          </div>

          <div className="mt-6 border-t border-border-subtle pt-6">
            <StatusForm
              applicationId={detail.id}
              currentStatus={detail.status}
            />
          </div>
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
        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Status History
          </h2>
          <ol className="mt-4 space-y-0">
            {history.map((entry, i) => (
              <li
                key={i}
                className="relative flex items-start gap-3 pb-5 text-sm last:pb-0"
              >
                <span className="mt-1 flex flex-col items-center">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      i === 0 ? "bg-primary" : "bg-primary-light"
                    }`}
                  />
                  {i < history.length - 1 && (
                    <span
                      className="mt-1 h-full w-px bg-border"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {historyActionLabel(
                      entry.action,
                      entry.previousStatus,
                      entry.newStatus,
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
