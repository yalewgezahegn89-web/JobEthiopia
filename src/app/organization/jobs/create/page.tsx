import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { and, inArray, eq } from "drizzle-orm";
import { CreateJobForm } from "./form";
import { Breadcrumb } from "@/components/public/breadcrumb";

export const dynamic = "force-dynamic";

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
    <div className="mx-auto max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Home", href: "/organization" },
          { label: "Jobs", href: "/organization/jobs" },
          { label: "Create job" },
        ]}
      />
      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Job management
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Create Job
        </h1>
        <p className="mt-1 text-sm text-muted">
          Post a new role for your organization.
        </p>
      </div>
      <div className="mt-6">
        <CreateJobForm organizations={orgs} />
      </div>
    </div>
  );
}
