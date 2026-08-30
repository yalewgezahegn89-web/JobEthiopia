import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import AdminNav from "../../../nav";
import CreateLocationForm from "./create-location-form";

export const metadata = {
  title: "Create Location | JobEthiopia Admin",
};

export default async function AdminLocationCreatePage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/taxonomy/locations" className="text-sm text-neutral-600 underline">
          &larr; Back to locations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Create Location</h1>
        <div className="mt-4">
          <CreateLocationForm />
        </div>
      </main>
    </div>
  );
}
