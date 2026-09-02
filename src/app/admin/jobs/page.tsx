import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listModerationJobs } from "@/lib/admin/jobs";
import AdminNav from "../nav";
import JobsList from "./jobs-list";

export const metadata = {
  title: "Job Moderation | JobEthiopia Admin",
};

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; verificationStatus?: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const status = params.status && params.status.length > 0 ? params.status : undefined;
  const verificationStatus =
    params.verificationStatus && params.verificationStatus.length > 0
      ? params.verificationStatus
      : undefined;

  let result;
  let loadError = false;
  try {
    result = await listModerationJobs({ page, limit: 20, status, verificationStatus });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Job Moderation
        </h1>
        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            We could not load the moderation queue right now. Please try again shortly.
          </p>
        ) : (
          <JobsList result={result!} currentStatus={status} currentVerification={verificationStatus} />
        )}
      </main>
    </div>
  );
}
