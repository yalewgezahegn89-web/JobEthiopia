import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listCategories } from "@/lib/admin/taxonomy";
import AdminNav from "../../nav";
import CategoryList from "./category-list";

export const metadata = {
  title: "Categories | JobEthiopia Admin",
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; isActive?: string; search?: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const isActive =
    params.isActive && params.isActive.length > 0
      ? params.isActive === "true"
      : undefined;
  const search = params.search && params.search.length > 0 ? params.search : undefined;

  let result;
  let loadError = false;
  try {
    result = await listCategories({ page, limit: 20, isActive, search });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Categories</h1>
          <Link
            href="/admin/taxonomy/categories/create"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Create category
          </Link>
        </div>
        {loadError ? (
          <p className="mt-4 text-neutral-600">
            We could not load the category list right now. Please try again shortly.
          </p>
        ) : (
          <CategoryList
            result={result!}
            currentIsActive={isActive}
            currentSearch={search}
          />
        )}
      </main>
    </div>
  );
}
