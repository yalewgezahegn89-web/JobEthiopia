import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listProfessions } from "@/lib/admin/taxonomy";
import AdminNav from "../../nav";
import ProfessionList from "./profession-list";

export const metadata = {
  title: "Professions | JobEthiopia Admin",
};

export default async function AdminProfessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; isActive?: string; categoryId?: string; search?: string }>;
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
  const categoryId =
    params.categoryId && params.categoryId.length > 0
      ? params.categoryId
      : undefined;
  const search = params.search && params.search.length > 0 ? params.search : undefined;

  let result;
  let loadError = false;
  try {
    result = await listProfessions({ page, limit: 20, isActive, categoryId, search });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Professions</h1>
          <Link
            href="/admin/taxonomy/professions/create"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Create profession
          </Link>
        </div>
        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            We could not load the profession list right now. Please try again shortly.
          </p>
        ) : (
          <ProfessionList
            result={result!}
            currentIsActive={isActive}
            currentCategoryId={categoryId}
            currentSearch={search}
          />
        )}
      </main>
    </div>
  );
}
