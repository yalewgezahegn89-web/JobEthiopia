import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireStaffAdmin } from "@/lib/auth/context";
import { canManagePrivilegedSourceFields } from "@/lib/auth/roles";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { sources } from "@/db/schema/sources";
import { MODERATOR_ELIGIBLE_ORIGINAL_SOURCE } from "@/lib/admin/curatedJobs";
import AdminNav from "../../nav";
import JobCreateForm from "./job-create-form";

export const metadata = {
  title: "Create Curated Job | JobEthiopia Admin",
};

export type JobCreateOptions = {
  organizations: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  professions: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  originalSources: { name: string }[];
};

export default async function AdminJobsCreatePage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/jobs");
  }

  let options: JobCreateOptions | null = null;
  let loadError = false;
  try {
    const [
      orgRows,
      categoryRows,
      professionRows,
      locationRows,
      originalSourceRows,
    ] = await Promise.all([
      db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.status, "ACTIVE"))
        .orderBy(asc(organizations.name)),
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.name)),
      db
        .select({ id: professions.id, name: professions.name })
        .from(professions)
        .where(eq(professions.isActive, true))
        .orderBy(asc(professions.name)),
      db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(eq(locations.isActive, true))
        .orderBy(asc(locations.name)),
      db
        .select({ name: sources.name })
        .from(sources)
        .where(
          and(
            eq(
              sources.sourceType,
              MODERATOR_ELIGIBLE_ORIGINAL_SOURCE.sourceType,
            ),
            eq(
              sources.trustLevel,
              MODERATOR_ELIGIBLE_ORIGINAL_SOURCE.trustLevel,
            ),
          ),
        )
        .orderBy(asc(sources.name)),
    ]);
    options = {
      organizations: orgRows,
      categories: categoryRows,
      professions: professionRows,
      locations: locationRows,
      originalSources: originalSourceRows,
    };
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link
          href="/admin/jobs"
          className="text-sm font-medium text-muted hover:text-primary"
        >
          &larr; Back to moderation queue
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Create Curated Job
        </h1>
        <p className="mt-1 text-sm text-muted">
          Enter a manually-curated job. It starts as DRAFT with PENDING
          verification and is reviewed by staff before publishing.
        </p>

        {loadError || options === null ? (
          <p className="mt-6 text-sm text-destructive">
            We could not load the job form options right now. Please try again
            shortly.
          </p>
        ) : (
          <div className="mt-6">
            <JobCreateForm
              {...options}
              canCreateOriginalSource={canManagePrivilegedSourceFields(
                guard.user.role,
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}