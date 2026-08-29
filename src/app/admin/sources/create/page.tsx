import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import AdminNav from "../../nav";
import CreateSourceForm from "./create-source-form";

export const metadata = {
  title: "Create Source | JobEthiopia Admin",
};

export default async function AdminSourceCreatePage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/sources" className="text-sm text-neutral-600 underline">
          &larr; Back to sources
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">Create Source</h1>

        <div className="mt-4">
          <CreateSourceForm />
        </div>
      </main>
    </div>
  );
}