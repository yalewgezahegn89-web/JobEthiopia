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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href="/admin/employer-requests"
          className="text-sm text-neutral-600 underline"
        >
          &larr; Back to employer requests
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{request.organizationName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Status: <strong>{request.status}</strong>
        </p>

        <div className="mt-4">
          <ReviewPanel
            requestId={request.id}
            status={request.status}
            canApprove={canApprove}
          />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          {request.description && (
            <p className="whitespace-pre-line text-neutral-700">
              {request.description}
            </p>
          )}
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Slug</dt>
              <dd>{request.organizationSlug}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Industry</dt>
              <dd>{request.industry ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Website</dt>
              <dd>
                {request.websiteUrl ? (
                  <a
                    href={request.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {request.websiteUrl}
                  </a>
                ) : (
                  "n/a"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Contact phone</dt>
              <dd>{request.contactPhone ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Submitter</dt>
              <dd>{request.submitterName ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Submitter email</dt>
              <dd>{request.submitterEmail ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Submitted</dt>
              <dd>{new Date(request.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        {request.status !== "PENDING" && request.reviewedAt && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Review outcome</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {request.status} on {new Date(request.reviewedAt).toLocaleString()}
            </p>
            {request.reviewNotes && (
              <p className="mt-1 text-sm text-neutral-600">
                Notes: {request.reviewNotes}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
