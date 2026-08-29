"use server";

/**
 * Admin source management server actions (Batch 57).
 *
 * Security order enforced in every action:
 *   1. Authenticate the session
 *   2. Authorize the role (staff only)
 *   3. Validate the CSRF / trusted origin
 *   4. Validate the target id + input
 *   5. Perform the update + audit row atomically
 *   6. Return a safe result
 *
 * Identity (actorUserId) always comes from the authenticated session; the
 * client can never supply an actor id, a role, a status, or a timestamp.
 */
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import {
  createSource,
  updateSource,
  deleteSource,
  toggleSourceActive,
} from "@/lib/admin/sources";

export type SourceActionResult = {
  ok: boolean;
  error?: string;
};

const GENERIC_ERROR = "Unable to update this source. Please try again.";
const GENERIC_FK_ERROR = "This source cannot be deleted because it is linked to existing jobs.";

export async function createSourceAction(
  _prevState: SourceActionResult,
  formData: FormData,
): Promise<SourceActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "");
  const baseUrl = String(formData.get("baseUrl") ?? "").trim() || undefined;
  const trustLevel = String(formData.get("trustLevel") ?? "").trim() || undefined;

  if (!name || !sourceType) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
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
    const result = await createSource(
      {
        name,
        sourceType,
        baseUrl: baseUrl || null,
        trustLevel: trustLevel || undefined,
      },
      actor.id,
    );
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function updateSourceAction(
  _prevState: SourceActionResult,
  formData: FormData,
): Promise<SourceActionResult> {
  const sourceId = String(formData.get("sourceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "");
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const trustLevel = String(formData.get("trustLevel") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
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

  const input: Record<string, unknown> = {};
  if (name) input.name = name;
  if (sourceType) input.sourceType = sourceType;
  if (baseUrl) input.baseUrl = baseUrl;
  if (baseUrl === "") input.baseUrl = null;
  if (trustLevel) input.trustLevel = trustLevel;

  try {
    const result = await updateSource(sourceId, input, actor.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function deleteSourceAction(
  _prevState: SourceActionResult,
  formData: FormData,
): Promise<SourceActionResult> {
  const sourceId = String(formData.get("sourceId") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
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
    const result = await deleteSource(sourceId, actor.id);
    if (!result.ok) {
      if (result.code === "FK_VIOLATION") {
        return { ok: false, error: GENERIC_FK_ERROR };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function toggleSourceActiveAction(
  _prevState: SourceActionResult,
  formData: FormData,
): Promise<SourceActionResult> {
  const sourceId = String(formData.get("sourceId") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
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
    const result = await toggleSourceActive(sourceId, actor.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
