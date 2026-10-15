import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listOrganizations } from "@/lib/admin/organizations";
import AdminNav from "../nav";

export const metadata: Metadata = {
  title: "Organizations | JobEthiopia Admin",
};

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; isVerified?: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const isVerifiedParam =
    params.isVerified && params.isVerified.length > 0
      ? params.isVerified
      : undefined;

  const isVerified =
    isVerifiedParam === "true"
      ? true
      : isVerifiedParam === "false"
        ? false
        : undefined;

  let loadError = false;
  let result: Awaited<ReturnType<typeof listOrganizations>> = {
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
  try {
    result = await listOrganizations({ page, limit: 20, isVerified });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Organizations</h1>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/organizations"
            className={`rounded-lg px-3 py-1 ${isVerified === undefined ? "bg-primary text-white shadow-sm" : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"}`}
          >
            All
          </Link>
          <Link
            href="/admin/organizations?isVerified=false"
            className={`rounded-lg px-3 py-1 ${isVerified === false ? "bg-primary text-white shadow-sm" : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"}`}
          >
            Unverified
          </Link>
          <Link
            href="/admin/organizations?isVerified=true"
            className={`rounded-lg px-3 py-1 ${isVerified === true ? "bg-primary text-white shadow-sm" : "bg-surface border border-border text-muted hover:bg-surface-raised hover:text-foreground"}`}
          >
            Verified
          </Link>
        </div>

        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            We could not load organizations right now. Please try again shortly.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">
              {result.total} total organizations
            </p>

            {result.items.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center bg-surface">
                <h2 className="text-lg font-semibold text-foreground">No organizations found</h2>
                <p className="mt-1 text-muted">
                  There are no organizations matching this filter.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.items.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-foreground hover:text-primary">{org.name}</h2>
                          <p className="text-sm text-muted">
                            {org.industry ?? "No industry"} · {org.status}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              org.isVerified
                                ? "bg-success-light text-success"
                                : "bg-warning-light text-warning"
                            }`}
                          >
                            {org.isVerified ? "Verified" : "Unverified"}
                          </span>
                          {org.verifiedAt && (
                            <p className="mt-1 text-xs text-subtle">
                              Verified {new Date(org.verifiedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {result.totalPages > 1 && (
              <nav
                className="mt-8 flex items-center justify-between gap-4"
                aria-label="Pagination"
              >
                {result.page > 1 ? (
                  <Link
                    href={`?page=${result.page - 1}${isVerified !== undefined ? `&isVerified=${isVerified}` : ""}`}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-raised hover:text-foreground"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-subtle">
                    Previous
                  </span>
                )}

                <span className="text-sm text-muted">
                  Page {result.page} of {result.totalPages}
                </span>

                {result.page < result.totalPages ? (
                  <Link
                    href={`?page=${result.page + 1}${isVerified !== undefined ? `&isVerified=${isVerified}` : ""}`}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-raised hover:text-foreground"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-subtle">
                    Next
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
