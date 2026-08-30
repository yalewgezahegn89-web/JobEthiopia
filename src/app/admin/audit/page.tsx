import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { listAuditLogs } from "@/lib/admin/audit";
import AdminNav from "../nav";
import AuditList from "./audit-list";

export const metadata = {
  title: "Audit Log | JobEthiopia Admin",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    action?: string;
    targetType?: string;
    actorUserId?: string;
  }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const action =
    params.action && params.action.length > 0 ? params.action : undefined;
  const targetType =
    params.targetType && params.targetType.length > 0
      ? params.targetType
      : undefined;
  const actorUserId =
    params.actorUserId && params.actorUserId.length > 0
      ? params.actorUserId
      : undefined;

  let result;
  let loadError = false;
  try {
    result = await listAuditLogs({ page, action, targetType, actorUserId });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        {loadError ? (
          <p className="mt-4 text-neutral-600">
            We could not load the audit log right now. Please try again
            shortly.
          </p>
        ) : (
          <AuditList
            result={result!}
            currentAction={action}
            currentTargetType={targetType}
            currentActorUserId={actorUserId}
          />
        )}
      </main>
    </div>
  );
}
