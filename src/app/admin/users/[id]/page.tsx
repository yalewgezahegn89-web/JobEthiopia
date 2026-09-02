import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getUser, getUserAuditHistory } from "@/lib/admin/users";
import AdminNav from "../../nav";
import UserDetail from "./user-detail";

export const metadata = {
  title: "User Detail | JobEthiopia Admin",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let user;
  let audit: Awaited<ReturnType<typeof getUserAuditHistory>> = [];
  let loadError = false;
  try {
    user = await getUser(id);
    if (user) {
      audit = await getUserAuditHistory(user.id);
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
            We could not load this user right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!user) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link href="/admin/users" className="text-sm font-medium text-muted hover:text-primary">
          &larr; Back to users
        </Link>

        <h1 className="mt-2 text-2xl font-bold text-foreground">{user.name}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <span>Role:</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            user.role === "SUPER_ADMIN" ? "bg-accent-light text-foreground" :
            user.role === "ADMIN" ? "bg-primary-light text-primary" :
            user.role === "MODERATOR" ? "bg-warning-light text-warning" :
            user.role === "ORGANIZATION_ADMIN" ? "bg-surface-raised border border-border-subtle text-muted" :
            "bg-surface-raised text-subtle"
          }`}>
            {user.role}
          </span>
          <span className="text-border-subtle">·</span>
          <span>Status:</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            user.isActive
              ? "bg-success-light text-success"
              : "bg-destructive-light text-destructive"
          }`}>
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="mt-4">
          <UserDetail user={user} actorRole={guard.user.role} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Account Details</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="text-sm font-medium text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Active sessions</dt>
              <dd className="text-sm font-medium text-foreground">
                {user.sessionCount} session{user.sessionCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Updated</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(user.updatedAt).toLocaleDateString()}</dd>
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
