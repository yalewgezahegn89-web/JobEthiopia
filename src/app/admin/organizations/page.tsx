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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Organizations</h1>

        <div className="mt-4 flex gap-2 text-sm">
          <Link
            href="/admin/organizations"
            className={`rounded-md px-3 py-1 ${isVerified === undefined ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            All
          </Link>
          <Link
            href="/admin/organizations?isVerified=false"
            className={`rounded-md px-3 py-1 ${isVerified === false ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            Unverified
          </Link>
          <Link
            href="/admin/organizations?isVerified=true"
            className={`rounded-md px-3 py-1 ${isVerified === true ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            Verified
          </Link>
        </div>

        {loadError ? (
          <p className="mt-4 text-neutral-600">
            We could not load organizations right now. Please try again shortly.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-neutral-500">
              {result.total} total organizations
            </p>

            {result.items.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center">
                <h2 className="text-lg font-semibold">No organizations found</h2>
                <p className="mt-1 text-neutral-600">
                  There are no organizations matching this filter.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {result.items.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="block rounded-md border border-neutral-200 p-4 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold">{org.name}</h2>
                          <p className="text-sm text-neutral-500">
                            {org.industry ?? "No industry"} · {org.status}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                              org.isVerified
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {org.isVerified ? "Verified" : "Unverified"}
                          </span>
                          {org.verifiedAt && (
                            <p className="mt-1 text-xs text-neutral-400">
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
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-400">
                    Previous
                  </span>
                )}

                <span className="text-sm text-neutral-600">
                  Page {result.page} of {result.totalPages}
                </span>

                {result.page < result.totalPages ? (
                  <Link
                    href={`?page=${result.page + 1}${isVerified !== undefined ? `&isVerified=${isVerified}` : ""}`}
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-400">
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
