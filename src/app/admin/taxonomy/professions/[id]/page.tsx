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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/taxonomy/professions" className="text-sm text-neutral-600 underline">
          &larr; Back to professions
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{profession.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Slug: <strong className="font-mono">{profession.slug}</strong> · Status:{" "}
          <strong className={profession.isActive ? "text-green-700" : "text-red-700"}>
            {profession.isActive ? "Active" : "Inactive"}
          </strong>
        </p>

        <div className="mt-4">
          <ProfessionDetail profession={profession} />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {profession.description && (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">Description</dt>
                <dd>{profession.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">Category</dt>
              <dd>{profession.categoryName ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Jobs</dt>
              <dd>{profession.jobCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Created</dt>
              <dd>{new Date(profession.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Updated</dt>
              <dd>{new Date(profession.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
