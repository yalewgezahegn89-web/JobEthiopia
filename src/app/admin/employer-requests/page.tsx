import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listEmployerOnboardingRequests } from "@/lib/admin/employerRequests";
import AdminNav from "../nav";

export const metadata: Metadata = {
  title: "Employer Requests | JobEthiopia Admin",
};

export default async function AdminEmployerRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const statusParam =
    params.status && params.status.length > 0 ? params.status : undefined;

  let loadError = false;
  let result: Awaited<ReturnType<typeof listEmployerOnboardingRequests>> = {
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
  try {
    result = await listEmployerOnboardingRequests({ page, limit: 20, status: statusParam });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Employer Requests</h1>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { label: "All", value: undefined },
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.label}
              href={
                tab.value === undefined
                  ? "/admin/employer-requests"
                  : `/admin/employer-requests?status=${tab.value}`
              }
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                statusParam === tab.value
                  ? "bg-primary text-white shadow-sm"
                  : "rounded-lg border border-border bg-surface text-muted hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            We could not load employer requests right now. Please try again shortly.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">
              {result.total} total requests
            </p>

            {result.items.length === 0 ? (
              <div className="mt-6 rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">No requests found</h2>
                <p className="mt-1 text-muted">
                  There are no employer onboarding requests matching this filter.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.items.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/admin/employer-requests/${request.id}`}
                      className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-foreground hover:text-primary">{request.organizationName}</h2>
                          <p className="text-sm text-muted">
                            {request.industry ?? "No industry"} · {request.organizationSlug}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              request.status === "APPROVED"
                                ? "bg-success-light text-success"
                                : request.status === "REJECTED"
                                  ? "bg-destructive-light text-destructive"
                                  : "bg-warning-light text-warning"
                            }`}
                          >
                            {request.status}
                          </span>
                          <p className="mt-1 text-xs text-subtle">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
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
                    href={`?page=${result.page - 1}${statusParam ? `&status=${statusParam}` : ""}`}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                    href={`?page=${result.page + 1}${statusParam ? `&status=${statusParam}` : ""}`}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
