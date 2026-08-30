import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { getEmployerJob } from "@/lib/employer/jobs";
import { OrganizationNav } from "@/app/organization/nav";
import { EditJobForm } from "./form";

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
    <>
      <OrganizationNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/organization/jobs/${job.id}`}
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Job
        </Link>
        <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Edit Job
        </h1>
        <EditJobForm job={job} />
      </main>
    </>
  );
}
