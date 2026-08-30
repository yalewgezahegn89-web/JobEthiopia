import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listUsers } from "@/lib/admin/users";
import AdminNav from "../nav";
import UsersList from "./users-list";

export const metadata = {
  title: "Users | JobEthiopia Admin",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; isActive?: string; role?: string }>;
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
  const role =
    params.role && params.role.length > 0
      ? (params.role as import("@/lib/auth/roles").UserRole)
      : undefined;

  let result;
  let loadError = false;
  try {
    result = await listUsers({ page, limit: 20, isActive, role });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">User Management</h1>
        {loadError ? (
          <p className="mt-4 text-neutral-600">
            We could not load the user list right now. Please try again shortly.
          </p>
        ) : (
          <UsersList
            result={result!}
            currentIsActive={isActive}
            currentRole={role}
          />
        )}
      </main>
    </div>
  );
}
