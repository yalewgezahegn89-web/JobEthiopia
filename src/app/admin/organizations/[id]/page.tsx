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
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <p className="text-sm text-destructive">
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
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link
          href="/admin/organizations"
          className="text-sm font-medium text-muted hover:text-primary"
        >
          &larr; Back to organizations
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{org.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Status: <strong className="text-foreground">{org.status}</strong> · Verification:{" "}
          <strong className="text-foreground">{org.isVerified ? "Verified" : "Unverified"}</strong>
        </p>

        {org.verifiedAt && (
          <p className="mt-1 text-sm text-subtle">
            Verified on {new Date(org.verifiedAt).toLocaleDateString()}
          </p>
        )}
        {org.verificationNotes && (
          <p className="mt-1 text-sm text-subtle">
            Notes: {org.verificationNotes}
          </p>
        )}

        <div className="mt-4">
          <VerificationPanel orgId={org.id} isVerified={org.isVerified} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          {org.description && (
            <p className="mt-2 whitespace-pre-line text-sm text-muted">
              {org.description}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Industry</dt>
              <dd className="text-sm font-medium text-foreground">{org.industry ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Slug</dt>
              <dd className="text-sm font-medium text-foreground">{org.slug}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Website</dt>
              <dd className="text-sm font-medium text-foreground">
                {org.websiteUrl ? (
                  <a
                    href={org.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {org.websiteUrl}
                  </a>
                ) : (
                  "n/a"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(org.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Audit history</h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No verification events recorded yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{entry.action}</span>
                    <span className="text-sm text-muted">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
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
