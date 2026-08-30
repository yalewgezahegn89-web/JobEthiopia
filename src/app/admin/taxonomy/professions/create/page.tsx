import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import AdminNav from "../../../nav";
import CreateProfessionForm from "./create-profession-form";

export const metadata = {
  title: "Create Profession | JobEthiopia Admin",
};

export default async function AdminProfessionCreatePage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/taxonomy/professions" className="text-sm text-neutral-600 underline">
          &larr; Back to professions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Create Profession</h1>
        <div className="mt-4">
          <CreateProfessionForm />
        </div>
      </main>
    </div>
  );
}
