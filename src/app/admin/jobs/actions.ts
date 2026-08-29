"use server";

/**
 * Admin job moderation server actions (Batch 51).
 *
 * Security order enforced in every action:
 *   1. Authenticate the session
 *   2. Authorize the role (staff only)
 *   3. Validate the CSRF / trusted origin
 *   4. Validate the target id + action enum (closed set)
 *   5. Load the target job
 *   6. Validate the allowed transition (single authoritative table)
 *   7. Perform the update + audit row atomically
 *   8. Return a safe result
 *
 * Identity (actorUserId) always comes from the authenticated session; the
 * client can never supply an actor id, a role, a status, or a timestamp.
 */
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { moderateJob, type ModerationAction } from "@/lib/admin/jobs";

export type ModerationActionResult = {
  ok: boolean;
  error?: string;
};

const ACTION_ENUM: readonly ModerationAction[] = [
  "PUBLISH",
  "REJECT",
  "MARK_INVALID",
  "REQUEST_REVIEW",
];

const GENERIC_ERROR = "Unable to update this job. Please try again.";

function isModerationAction(value: string): value is ModerationAction {
  return (ACTION_ENUM as readonly string[]).includes(value);
}

export async function moderateJobAction(
  _prevState: ModerationActionResult,
  formData: FormData,
): Promise<ModerationActionResult> {
  const jobId = String(formData.get("jobId") ?? "");
  const actionRaw = String(formData.get("action") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!isModerationAction(actionRaw)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/jobs");
  }
  const actor = guard.user;

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await moderateJob(jobId, actionRaw, actor.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
