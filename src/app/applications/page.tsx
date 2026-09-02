import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { listApplicationsForCandidate } from "@/lib/applications/dal";
import { ApplicationHistory } from "@/components/applications/history";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { BuildingIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Applications | JobEthiopia",
  description: "Your job applications on JobEthiopia.",
};

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) {
    redirect("/jobs");
  }

  let items: Awaited<ReturnType<typeof listApplicationsForCandidate>>["items"] = [];
  let loadError = false;

  try {
    const result = await listApplicationsForCandidate(user.id, { limit: 100 });
    items = result.items;
  } catch {
    loadError = true;
  }

  const applicationCount = items.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "My Applications" }]}
      />

      <header className="mt-4 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Candidate workspace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          My Applications
        </h1>
        <p className="mt-2 text-base leading-7 text-muted">
          Applications you have submitted and their current status.
        </p>
      </header>

      {loadError ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center" role="status">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-primary">
            <BuildingIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-muted">
            We could not load your applications right now. Please try again
            shortly.
          </p>
          <Link
            href="/applications"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Retry
          </Link>
        </div>
      ) : (
        <>
          {!loadError && applicationCount > 0 && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              <BuildingIcon className="h-3.5 w-3.5" />
              {applicationCount} tracked application
              {applicationCount === 1 ? "" : "s"}
            </p>
          )}

          <ApplicationHistory items={items} />
        </>
      )}
    </div>
  );
}