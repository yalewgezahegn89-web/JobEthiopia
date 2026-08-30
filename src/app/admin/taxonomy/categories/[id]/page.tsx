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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/taxonomy/categories" className="text-sm text-neutral-600 underline">
          &larr; Back to categories
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{category.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Slug: <strong className="font-mono">{category.slug}</strong> · Status:{" "}
          <strong className={category.isActive ? "text-green-700" : "text-red-700"}>
            {category.isActive ? "Active" : "Inactive"}
          </strong>
        </p>

        <div className="mt-4">
          <CategoryDetail category={category} />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {category.description && (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">Description</dt>
                <dd>{category.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">Parent</dt>
              <dd>{category.parentName ?? "None (root)"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Sort order</dt>
              <dd>{category.sortOrder}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Children</dt>
              <dd>{category.childCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Jobs</dt>
              <dd>{category.jobCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Professions</dt>
              <dd>{category.professionCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Created</dt>
              <dd>{new Date(category.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Updated</dt>
              <dd>{new Date(category.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        {category.children.length > 0 && (
          <section className="mt-6 text-sm">
            <h2 className="text-lg font-semibold">Children</h2>
            <ul className="mt-2 space-y-1">
              {category.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/admin/taxonomy/categories/${child.id}`}
                    className="text-neutral-700 underline hover:text-neutral-900"
                  >
                    {child.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-neutral-500">{child.slug}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
