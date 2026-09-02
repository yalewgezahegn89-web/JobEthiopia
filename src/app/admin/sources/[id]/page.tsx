import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getSource, getSourceAuditHistory } from "@/lib/admin/sources";
import AdminNav from "../../nav";
import SourceDetail from "./source-detail";

export const metadata = {
  title: "Source Detail | JobEthiopia Admin",
};

export default async function AdminSourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let source;
  let audit: Awaited<ReturnType<typeof getSourceAuditHistory>> = [];
  let loadError = false;
  try {
    source = await getSource(id);
    if (source) {
      audit = await getSourceAuditHistory(source.id);
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
            We could not load this source right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!source) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link href="/admin/sources" className="text-sm font-medium text-muted hover:text-primary">
          &larr; Back to sources
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{source.name}</h1>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-foreground">Type:</span>{" "}
          <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted">
            {source.sourceType}
          </span>{" "}
          <span className="font-medium text-foreground">Trust:</span>{" "}
          <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted">
            {source.trustLevel}
          </span>{" "}
          <span className="font-medium text-foreground">Status:</span>{" "}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              source.isActive ? "bg-success-light text-success" : "bg-destructive-light text-destructive"
            }`}
          >
            {source.isActive ? "Active" : "Inactive"}
          </span>
        </p>

        <div className="mt-4">
          <SourceDetail source={source} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Health</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Last successful check</dt>
              <dd className="text-sm font-medium text-foreground">{source.lastSuccessfulCheck ? new Date(source.lastSuccessfulCheck).toLocaleString() : "Never"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Last attempted check</dt>
              <dd className="text-sm font-medium text-foreground">{source.lastAttemptedCheck ? new Date(source.lastAttemptedCheck).toLocaleString() : "Never"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Last error</dt>
              <dd className={`text-sm font-medium ${source.lastError ? "text-destructive" : "text-foreground"}`}>
                {source.lastError ?? "None"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Consecutive failures</dt>
              <dd className={`text-sm font-medium ${source.consecutiveFailures > 0 ? "text-destructive" : "text-foreground"}`}>
                {source.consecutiveFailures}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Check frequency (minutes)</dt>
              <dd className="text-sm font-medium text-foreground">{source.checkFrequencyMinutes ?? "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Base URL</dt>
              <dd className="text-sm font-medium text-foreground">{source.baseUrl ?? "Not configured"}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(source.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Updated</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(source.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Audit history</h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No management events recorded yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {audit.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-4">
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
