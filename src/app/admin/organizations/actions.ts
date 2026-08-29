"use server";

/**
 * Admin organization verification server actions (Batch 53).
 *
 * Security order enforced in every action:
 *   1. Authenticate the session
 *   2. Authorize the role (staff only)
 *   3. Validate the CSRF / trusted origin
 *   4. Validate the target id + action enum (closed set)
 *   5. Load the target organization
 *   6. Validate the allowed transition (compare-and-swap)
 *   7. Perform the update + audit row atomically
 *   8. Return a safe result
 *
 * Identity (actorUserId) always comes from the authenticated session; the
 * client can never supply an actor id, a role, a status, or a timestamp.
 */
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import {
  verifyOrganization,
  type OrganizationVerificationAction,
} from "@/lib/admin/organizations";

export type VerificationActionResult = {
  ok: boolean;
  error?: string;
};

const ACTION_ENUM: readonly OrganizationVerificationAction[] = [
  "VERIFY",
  "REJECT",
  "REQUEST_REVIEW",
];

const GENERIC_ERROR = "Unable to update this organization. Please try again.";
const MAX_NOTES_LENGTH = 2000;

function isVerificationAction(value: string): value is OrganizationVerificationAction {
  return (ACTION_ENUM as readonly string[]).includes(value);
}

export async function verifyOrganizationAction(
  _prevState: VerificationActionResult,
  formData: FormData,
): Promise<VerificationActionResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const actionRaw = String(formData.get("action") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!isVerificationAction(actionRaw)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/organizations");
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
    const result = await verifyOrganization(orgId, actionRaw, actor.id, notes);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
