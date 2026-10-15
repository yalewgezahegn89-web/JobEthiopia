import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getEmployerOnboardingRequest } from "@/lib/admin/employerRequests";
import AdminNav from "../../nav";
import ReviewPanel from "./review-panel";

export const metadata = {
  title: "Employer Request Detail | JobEthiopia Admin",
};

export default async function AdminEmployerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }
  const actor = guard.user;

  const { id } = await params;

  let request;
  let loadError = false;
  try {
    request = await getEmployerOnboardingRequest(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <p className="text-sm text-destructive">
            We could not load this request right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!request) {
    notFound();
  }

  const canApprove = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";

  const statusBadgeClass =
    request.status === "APPROVED"
      ? "bg-success-light text-success"
      : request.status === "REJECTED"
        ? "bg-destructive-light text-destructive"
        : "bg-warning-light text-warning";

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link
          href="/admin/employer-requests"
          className="text-sm font-medium text-muted hover:text-primary"
        >
          &larr; Back to employer requests
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{request.organizationName}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <span>Status:</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass}`}>
            {request.status}
          </span>
        </div>

        <div className="mt-6">
          <ReviewPanel
            requestId={request.id}
            status={request.status}
            canApprove={canApprove}
          />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          {request.description && (
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">
              {request.description}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Slug</dt>
              <dd className="text-sm font-medium text-foreground">{request.organizationSlug}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Industry</dt>
              <dd className="text-sm font-medium text-foreground">{request.industry ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Website</dt>
              <dd className="text-sm font-medium text-foreground">
                {request.websiteUrl ? (
                  <a
                    href={request.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-foreground"
                  >
                    {request.websiteUrl}
                  </a>
                ) : (
                  "n/a"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Contact phone</dt>
              <dd className="text-sm font-medium text-foreground">{request.contactPhone ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Submitter</dt>
              <dd className="text-sm font-medium text-foreground">{request.submitterName ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Submitter email</dt>
              <dd className="text-sm font-medium text-foreground">{request.submitterEmail ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Submitted</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(request.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        {request.status !== "PENDING" && request.reviewedAt && (
          <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Review outcome</h2>
            <p className="mt-1 text-sm text-muted">
              {request.status} on {new Date(request.reviewedAt).toLocaleString()}
            </p>
            {request.reviewNotes && (
              <p className="mt-1 text-sm text-foreground">
                Notes: {request.reviewNotes}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
