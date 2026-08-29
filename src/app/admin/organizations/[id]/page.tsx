import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import {
  getOrganization,
  getOrganizationAuditHistory,
} from "@/lib/admin/organizations";
import AdminNav from "../../nav";
import VerificationPanel from "./verification-panel";

export const metadata = {
  title: "Organization Detail | JobEthiopia Admin",
};

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let org;
  let audit: Awaited<ReturnType<typeof getOrganizationAuditHistory>> = [];
  let loadError = false;
  try {
    org = await getOrganization(id);
    if (org) {
      audit = await getOrganizationAuditHistory(org.id);
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
            We could not load this organization right now. Please try again
            shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!org) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href="/admin/organizations"
          className="text-sm text-neutral-600 underline"
        >
          &larr; Back to organizations
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{org.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Status: <strong>{org.status}</strong> · Verification:{" "}
          <strong>{org.isVerified ? "Verified" : "Unverified"}</strong>
        </p>

        {org.verifiedAt && (
          <p className="mt-1 text-sm text-neutral-500">
            Verified on {new Date(org.verifiedAt).toLocaleDateString()}
          </p>
        )}
        {org.verificationNotes && (
          <p className="mt-1 text-sm text-neutral-500">
            Notes: {org.verificationNotes}
          </p>
        )}

        <div className="mt-4">
          <VerificationPanel orgId={org.id} isVerified={org.isVerified} />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          {org.description && (
            <p className="whitespace-pre-line text-neutral-700">
              {org.description}
            </p>
          )}
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Industry</dt>
              <dd>{org.industry ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Slug</dt>
              <dd>{org.slug}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Website</dt>
              <dd>
                {org.websiteUrl ? (
                  <a
                    href={org.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {org.websiteUrl}
                  </a>
                ) : (
                  "n/a"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Created</dt>
              <dd>{new Date(org.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Audit history</h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">
              No verification events recorded yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-neutral-200 p-3"
                >
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
