import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import AdminNav from "../nav";

export const metadata = {
  title: "Taxonomy | JobEthiopia Admin",
};

export default async function AdminTaxonomyPage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Taxonomy Management</h1>
        <p className="mt-2 text-neutral-600">
          Manage categories, professions, and locations used across the platform.
        </p>

        <ul className="mt-6 space-y-3">
          <li>
            <Link
              href="/admin/taxonomy/categories"
              className="block rounded-md border border-neutral-200 p-4 hover:bg-neutral-50"
            >
              <span className="font-medium">Categories</span>
              <p className="mt-1 text-sm text-neutral-500">
                Job categories and their hierarchy.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/admin/taxonomy/professions"
              className="block rounded-md border border-neutral-200 p-4 hover:bg-neutral-50"
            >
              <span className="font-medium">Professions</span>
              <p className="mt-1 text-sm text-neutral-500">
                Professional titles and their category assignments.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/admin/taxonomy/locations"
              className="block rounded-md border border-neutral-200 p-4 hover:bg-neutral-50"
            >
              <span className="font-medium">Locations</span>
              <p className="mt-1 text-sm text-neutral-500">
                Geographic locations and their hierarchy.
              </p>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
