import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { getEmployerJob } from "@/lib/employer/jobs";
import { EditJobForm } from "./form";
import { Breadcrumb } from "@/components/public/breadcrumb";

export const dynamic = "force-dynamic";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) redirect("/login");

  const user = await verifySession(rawToken);
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const { id } = await params;

  let job;
  try {
    job = await getEmployerJob(user.id, id);
  } catch {
    notFound();
  }

  if (!job) notFound();

  if (job.status !== "DRAFT" && job.status !== "PENDING_REVIEW") {
    redirect(`/organization/jobs/${job.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Home", href: "/organization" },
          { label: "Jobs", href: "/organization/jobs" },
          { label: job.title, href: `/organization/jobs/${job.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Job management
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Edit Job
        </h1>
        <p className="mt-1 text-sm text-muted">
          Update this draft before it is published.
        </p>
      </div>
      <div className="mt-6">
        <EditJobForm job={job} />
      </div>
    </div>
  );
}
