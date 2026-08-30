import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import AdminNav from "../../../nav";
import CreateCategoryForm from "./create-category-form";

export const metadata = {
  title: "Create Category | JobEthiopia Admin",
};

export default async function AdminCategoryCreatePage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/taxonomy/categories" className="text-sm text-neutral-600 underline">
          &larr; Back to categories
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Create Category</h1>
        <div className="mt-4">
          <CreateCategoryForm />
        </div>
      </main>
    </div>
  );
}
