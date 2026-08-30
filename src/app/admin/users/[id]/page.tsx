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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/users" className="text-sm text-neutral-600 underline">
          &larr; Back to users
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{user.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Role: <strong>{user.role}</strong> · Status:{" "}
          <strong className={user.isActive ? "text-green-700" : "text-red-700"}>
            {user.isActive ? "Active" : "Inactive"}
          </strong>
        </p>

        <div className="mt-4">
          <UserDetail user={user} actorRole={guard.user.role} />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Account Details</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Active sessions</dt>
              <dd>
                {user.sessionCount} session{user.sessionCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Created</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Updated</dt>
              <dd>{new Date(user.updatedAt).toLocaleDateString()}</dd>
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
