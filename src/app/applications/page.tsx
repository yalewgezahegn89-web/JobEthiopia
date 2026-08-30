import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { listApplicationsForCandidate } from "@/lib/applications/dal";
import { ApplicationHistory } from "@/components/applications/history";

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Applications you have submitted and their current status.
      </p>

      {loadError ? (
        <div className="mt-6 rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-300">
            We could not load your applications right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <ApplicationHistory items={items} />
      )}
    </div>
  );
}
