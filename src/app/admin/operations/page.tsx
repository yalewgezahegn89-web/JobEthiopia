import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getOperationsSummary } from "@/lib/admin/operations";
import AdminNav from "../nav";
import OperationsDashboard from "./operations-dashboard";

export const metadata = {
  title: "Operations | JobEthiopia Admin",
};

export default async function AdminOperationsPage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  let summary;
  let loadError = false;
  try {
    summary = await getOperationsSummary();
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Operations</h1>
        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            We could not load operations data right now. Please try again shortly.
          </p>
        ) : (
          <OperationsDashboard summary={summary!} />
        )}
      </main>
    </div>
  );
}
