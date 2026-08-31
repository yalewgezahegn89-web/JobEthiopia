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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Employer Requests</h1>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
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
              className={`rounded-md px-3 py-1 ${
                statusParam === tab.value
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {loadError ? (
          <p className="mt-4 text-neutral-600">
            We could not load employer requests right now. Please try again shortly.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-neutral-500">
              {result.total} total requests
            </p>

            {result.items.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center">
                <h2 className="text-lg font-semibold">No requests found</h2>
                <p className="mt-1 text-neutral-600">
                  There are no employer onboarding requests matching this filter.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {result.items.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/admin/employer-requests/${request.id}`}
                      className="block rounded-md border border-neutral-200 p-4 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold">{request.organizationName}</h2>
                          <p className="text-sm text-neutral-500">
                            {request.industry ?? "No industry"} · {request.organizationSlug}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                              request.status === "APPROVED"
                                ? "bg-green-100 text-green-800"
                                : request.status === "REJECTED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {request.status}
                          </span>
                          <p className="mt-1 text-xs text-neutral-400">
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
                    href={`?page=${result.page + 1}${statusParam ? `&status=${statusParam}` : ""}`}
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
