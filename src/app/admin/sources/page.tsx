import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listSources } from "@/lib/admin/sources";
import AdminNav from "../nav";
import SourcesList from "./sources-list";

export const metadata = {
  title: "Sources | JobEthiopia Admin",
};

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; isActive?: string; sourceType?: string }>;
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
  const sourceType =
    params.sourceType && params.sourceType.length > 0
      ? params.sourceType
      : undefined;

  let result;
  let loadError = false;
  try {
    result = await listSources({ page, limit: 20, isActive, sourceType });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Source Management</h1>
        {loadError ? (
          <p className="mt-4 text-neutral-600">
            We could not load the source list right now. Please try again shortly.
          </p>
        ) : (
          <SourcesList
            result={result!}
            currentIsActive={isActive}
            currentSourceType={sourceType}
          />
        )}
      </main>
    </div>
  );
}
