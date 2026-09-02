import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getModerationJob, getJobAuditHistory } from "@/lib/admin/jobs";
import AdminNav from "../../nav";
import ModerationPanel from "./moderation-panel";

export const metadata = {
  title: "Job Moderation Detail | JobEthiopia Admin",
};

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let job;
  let audit: Awaited<ReturnType<typeof getJobAuditHistory>> = [];
  let loadError = false;
  try {
    job = await getModerationJob(id);
    if (job) {
      audit = await getJobAuditHistory(job.id);
    }
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <p className="text-sm text-destructive">
            We could not load this job right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link
          href="/admin/jobs"
          className="text-sm font-medium text-muted hover:text-primary"
        >
          &larr; Back to moderation queue
        </Link>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          {job.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Status: <strong>{job.status}</strong> · Verification:{" "}
          <strong>{job.verificationStatus}</strong>
        </p>

        <div className="mt-4">
          <ModerationPanel
            jobId={job.id}
            status={job.status}
            verificationStatus={job.verificationStatus}
          />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          <p className="mt-3 whitespace-pre-line text-foreground">
            {job.description}
          </p>
          {job.requirements && (
            <p className="mt-3 whitespace-pre-line text-foreground">
              <strong>Requirements:</strong> {job.requirements}
            </p>
          )}
          {job.responsibilities && (
            <p className="mt-3 whitespace-pre-line text-foreground">
              <strong>Responsibilities:</strong> {job.responsibilities}
            </p>
          )}
          {job.benefits && (
            <p className="mt-3 whitespace-pre-line text-foreground">
              <strong>Benefits:</strong> {job.benefits}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">Employment type</dt><dd className="text-sm font-medium text-foreground">{job.employmentType ?? "n/a"}</dd></div>
            <div><dt className="text-sm text-muted">Salary</dt><dd className="text-sm font-medium text-foreground">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</dd></div>
            <div><dt className="text-sm text-muted">Posted</dt><dd className="text-sm font-medium text-foreground">{job.postedAt ? new Date(job.postedAt).toLocaleString() : "n/a"}</dd></div>
            <div><dt className="text-sm text-muted">Deadline</dt><dd className="text-sm font-medium text-foreground">{job.deadline ? new Date(job.deadline).toLocaleString() : "n/a"}</dd></div>
            <div><dt className="text-sm text-muted">Last verified</dt><dd className="text-sm font-medium text-foreground">{job.lastVerifiedAt ? new Date(job.lastVerifiedAt).toLocaleString() : "n/a"}</dd></div>
            {job.applicationUrl && (
              <div><dt className="text-sm text-muted">Application URL</dt><dd className="text-sm font-medium text-foreground"><a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{job.applicationUrl}</a></dd></div>
            )}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">
            Moderation history
          </h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No moderation events recorded yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-3 text-sm">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-foreground">
                      {entry.action}
                    </span>
                    <span className="shrink-0 text-xs text-subtle">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    by {entry.actorEmail ?? "system"}
                  </div>
                  {entry.metadata ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-raised p-3 text-xs text-muted">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function formatSalary(
  min: string | number | null,
  max: string | number | null,
  currency: string | null,
): string {
  if (min == null && max == null) return "n/a";
  const parts = [];
  if (min != null) parts.push(String(min));
  if (max != null) parts.push(String(max));
  const value = parts.length === 2 ? `${parts[0]} - ${parts[1]}` : parts[0];
  return currency ? `${value} ${currency}` : value;
}
