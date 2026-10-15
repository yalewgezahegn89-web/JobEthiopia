import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getCategory } from "@/lib/admin/taxonomy";
import AdminNav from "../../../nav";
import CategoryDetail from "./category-detail";

export const metadata = {
  title: "Category Detail | JobEthiopia Admin",
};

export default async function AdminCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let category;
  let loadError = false;
  try {
    category = await getCategory(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <p className="text-sm text-destructive">
            We could not load this category right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!category) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link href="/admin/taxonomy/categories" className="text-sm font-medium text-muted hover:text-primary">
          &larr; Back to categories
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{category.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            Slug: <strong className="font-mono text-foreground">{category.slug}</strong>
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              category.isActive ? "bg-success-light text-success" : "bg-destructive-light text-destructive"
            }`}
          >
            {category.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="mt-4">
          <CategoryDetail category={category} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {category.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Description</dt>
                <dd className="text-sm font-medium text-foreground">{category.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted">Parent</dt>
              <dd className="text-sm font-medium text-foreground">{category.parentName ?? "None (root)"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Sort order</dt>
              <dd className="text-sm font-medium text-foreground">{category.sortOrder}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Children</dt>
              <dd className="text-sm font-medium text-foreground">{category.childCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Jobs</dt>
              <dd className="text-sm font-medium text-foreground">{category.jobCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Professions</dt>
              <dd className="text-sm font-medium text-foreground">{category.professionCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(category.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Updated</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(category.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        {category.children.length > 0 && (
          <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Children</h2>
            <ul className="mt-4 space-y-2">
              {category.children.map((child) => (
                <li key={child.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <Link
                    href={`/admin/taxonomy/categories/${child.id}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {child.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-subtle">{child.slug}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
