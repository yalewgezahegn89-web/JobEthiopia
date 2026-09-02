import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getProfession } from "@/lib/admin/taxonomy";
import AdminNav from "../../../nav";
import ProfessionDetail from "./profession-detail";

export const metadata = {
  title: "Profession Detail | JobEthiopia Admin",
};

export default async function AdminProfessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let profession;
  let loadError = false;
  try {
    profession = await getProfession(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <p className="text-sm text-destructive">
            We could not load this profession right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!profession) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link href="/admin/taxonomy/professions" className="text-sm font-medium text-muted hover:text-primary">
          &larr; Back to professions
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{profession.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            Slug: <strong className="font-mono text-foreground">{profession.slug}</strong>
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              profession.isActive ? "bg-success-light text-success" : "bg-destructive-light text-destructive"
            }`}
          >
            {profession.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="mt-4">
          <ProfessionDetail profession={profession} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {profession.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Description</dt>
                <dd className="text-sm font-medium text-foreground">{profession.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted">Category</dt>
              <dd className="text-sm font-medium text-foreground">{profession.categoryName ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Jobs</dt>
              <dd className="text-sm font-medium text-foreground">{profession.jobCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(profession.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Updated</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(profession.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
