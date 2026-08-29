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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/sources" className="text-sm text-neutral-600 underline">
          &larr; Back to sources
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{source.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Type: <strong>{source.sourceType}</strong> · Trust:{" "}
          <strong>{source.trustLevel}</strong> · Status:{" "}
          <strong className={source.isActive ? "text-green-700" : "text-red-700"}>
            {source.isActive ? "Active" : "Inactive"}
          </strong>
        </p>

        <div className="mt-4">
          <SourceDetail source={source} />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Health</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Last successful check</dt>
              <dd>{source.lastSuccessfulCheck ? new Date(source.lastSuccessfulCheck).toLocaleString() : "Never"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Last attempted check</dt>
              <dd>{source.lastAttemptedCheck ? new Date(source.lastAttemptedCheck).toLocaleString() : "Never"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Last error</dt>
              <dd className={source.lastError ? "text-red-700" : ""}>
                {source.lastError ?? "None"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Consecutive failures</dt>
              <dd className={source.consecutiveFailures > 0 ? "text-red-700 font-medium" : ""}>
                {source.consecutiveFailures}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Check frequency (minutes)</dt>
              <dd>{source.checkFrequencyMinutes ?? "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Base URL</dt>
              <dd>{source.baseUrl ?? "Not configured"}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Created</dt>
              <dd>{new Date(source.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Updated</dt>
              <dd>{new Date(source.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Audit history</h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">
              No management events recorded yet.
            </p>
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
