"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { runSourceIngestion } from "@/lib/ingestion/runSource";

export type SourceSyncResult = {
  ok: boolean;
  status?: string;
  message?: string;
  error?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Unable to run this source right now. Please try again.";

/**
 * Manually triggers a single source ingestion run. Authentication, role,
 * CSRF, and id validation all follow the same order as the other admin
 * source actions. The result reports the run status and failure reason.
 */
export async function syncSourceAction(
  _prevState: SourceSyncResult,
  formData: FormData,
): Promise<SourceSyncResult> {
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!UUID_REGEX.test(sourceId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await runSourceIngestion(sourceId);
    revalidatePath(`/admin/sources/${sourceId}`);
    revalidatePath("/admin/sources");

    if (result.status === "FAILED") {
      return {
        ok: false,
        status: result.status,
        error: result.reason ?? "Ingestion run failed.",
      };
    }

    if (result.status === "SKIPPED") {
      return {
        ok: true,
        status: result.status,
        message: result.reason ?? "Source was skipped.",
      };
    }

    return {
      ok: true,
      status: result.status,
      message: `Sync completed: ${result.total} received, ${result.created} created, ${result.updated} updated, ${result.failed} failed.`,
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
