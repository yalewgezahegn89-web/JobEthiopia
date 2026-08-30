import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { and, inArray, eq } from "drizzle-orm";
import { OrganizationNav } from "@/app/organization/nav";
import { CreateJobForm } from "./form";

export default async function CreateJobPage() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) redirect("/login");

  const user = await verifySession(rawToken);
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const orgIds = await getUserOrganizationIds(user.id);
  if (orgIds.length === 0) redirect("/organization/jobs");

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(
      and(
        inArray(organizations.id, orgIds),
        eq(organizations.status, "ACTIVE"),
      ),
    );

  if (orgs.length === 0) redirect("/organization/jobs");

  return (
    <>
      <OrganizationNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/organization/jobs"
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Jobs
        </Link>
        <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Create Job
        </h1>
        <CreateJobForm organizations={orgs} />
      </main>
    </>
  );
}
