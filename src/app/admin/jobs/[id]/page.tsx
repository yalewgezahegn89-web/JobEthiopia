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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/jobs" className="text-sm text-neutral-600 underline">
          &larr; Back to moderation queue
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{job.title}</h1>
        <p className="mt-1 text-sm text-neutral-600">
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

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          <p className="whitespace-pre-line text-neutral-700">{job.description}</p>
          {job.requirements && (
            <p className="whitespace-pre-line text-neutral-700">
              <strong>Requirements:</strong> {job.requirements}
            </p>
          )}
          {job.responsibilities && (
            <p className="whitespace-pre-line text-neutral-700">
              <strong>Responsibilities:</strong> {job.responsibilities}
            </p>
          )}
          {job.benefits && (
            <p className="whitespace-pre-line text-neutral-700">
              <strong>Benefits:</strong> {job.benefits}
            </p>
          )}
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div><dt className="text-neutral-500">Employment type</dt><dd>{job.employmentType ?? "n/a"}</dd></div>
            <div><dt className="text-neutral-500">Salary</dt><dd>{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</dd></div>
            <div><dt className="text-neutral-500">Posted</dt><dd>{job.postedAt ? new Date(job.postedAt).toLocaleString() : "n/a"}</dd></div>
            <div><dt className="text-neutral-500">Deadline</dt><dd>{job.deadline ? new Date(job.deadline).toLocaleString() : "n/a"}</dd></div>
            <div><dt className="text-neutral-500">Last verified</dt><dd>{job.lastVerifiedAt ? new Date(job.lastVerifiedAt).toLocaleString() : "n/a"}</dd></div>
            {job.applicationUrl && (
              <div><dt className="text-neutral-500">Application URL</dt><dd><a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{job.applicationUrl}</a></dd></div>
            )}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Moderation history</h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">No moderation events recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {audit.map((entry) => (
                <li key={entry.id} className="rounded-md border border-neutral-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    by {entry.actorEmail ?? "system"}
                  </div>
                  {entry.metadata ? (
                    <pre className="mt-1 overflow-x-auto text-xs text-neutral-600">
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
