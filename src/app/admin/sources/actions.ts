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
import {
  authorizeSourceMutation,
  canManagePrivilegedSourceFields,
  toStaffSourceActor,
} from "@/lib/auth/roles";
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
const PRIVILEGED_FIELDS_ERROR =
  "You do not have permission to grant HIGH trust or enable auto-publish.";
const LIFECYCLE_DENIED_ERROR =
  "You do not have permission to change this source's lifecycle.";
const GENERIC_FK_ERROR = "This source cannot be deleted because it is linked to existing jobs.";
const INVALID_FREQUENCY =
  "Check frequency must be a whole number between 5 and 10080 minutes, or blank.";

function parseCheckFrequency(raw: string): number | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 10080) {
    return undefined;
  }
  return parsed;
}

function readFacebookFields(formData: FormData) {
  return {
    facebookPageId:
      String(formData.get("facebookPageId") ?? "").trim() || null,
    facebookPageKind:
      String(formData.get("facebookPageKind") ?? "").trim() || null,
    facebookApprovalState:
      String(formData.get("facebookApprovalState") ?? "").trim() || null,
    facebookContentUseState:
      String(formData.get("facebookContentUseState") ?? "").trim() || null,
    facebookAuthorizationNote:
      String(formData.get("facebookAuthorizationNote") ?? "").trim() || null,
  };
}

const FACEBOOK_FORM_FIELDS = [
  "facebookPageId",
  "facebookPageKind",
  "facebookApprovalState",
  "facebookContentUseState",
  "facebookAuthorizationNote",
] as const;

function readProvidedFacebookFields(formData: FormData) {
  const fields: Record<string, string | null> = {};

  for (const field of FACEBOOK_FORM_FIELDS) {
    if (!formData.has(field)) continue;
    const value = String(formData.get(field) ?? "").trim() || null;

    if (field === "facebookApprovalState") {
      fields[field] = value ?? "NOT_REQUESTED";
    } else if (field === "facebookContentUseState") {
      fields[field] = value ?? "NOT_RECORDED";
    } else {
      fields[field] = value;
    }
  }

  return fields;
}

export async function createSourceAction(
  _prevState: SourceActionResult,
  formData: FormData,
): Promise<SourceActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "");
  const baseUrl = String(formData.get("baseUrl") ?? "").trim() || undefined;
  const trustLevel = String(formData.get("trustLevel") ?? "").trim() || undefined;
  const autoPublish = formData.get("autoPublish") === "true";
  const checkFrequencyMinutes = parseCheckFrequency(
    String(formData.get("checkFrequencyMinutes") ?? ""),
  );
  const facebook = readFacebookFields(formData);

  if (!name || !sourceType) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (checkFrequencyMinutes === undefined) {
    return { ok: false, error: INVALID_FREQUENCY };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
  }
  const actor = toStaffSourceActor(guard.user);

  if (
    !authorizeSourceMutation(actor, {
      trustLevel,
      autoPublish,
      sourceType,
      ...facebook,
      operation: "create",
    }).ok
  ) {
    return { ok: false, error: PRIVILEGED_FIELDS_ERROR };
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
    const result = await createSource(
      {
        name,
        sourceType,
        baseUrl: baseUrl || null,
        trustLevel: trustLevel || undefined,
        autoPublish,
        checkFrequencyMinutes,
        ...facebook,
      },
      actor,
    );
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.code === "FORBIDDEN"
            ? PRIVILEGED_FIELDS_ERROR
            : GENERIC_ERROR,
      };
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
  const autoPublishRaw = String(formData.get("autoPublish") ?? "");
  const autoPublish = autoPublishRaw === "true";
  const autoPublishProvided =
    autoPublishRaw === "true" || autoPublishRaw === "false";
  const checkFrequencyMinutes = parseCheckFrequency(
    String(formData.get("checkFrequencyMinutes") ?? ""),
  );
  const facebook = readProvidedFacebookFields(formData);
  const facebookProvided = Object.keys(facebook).length > 0;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (checkFrequencyMinutes === undefined) {
    return { ok: false, error: INVALID_FREQUENCY };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/sources");
  }
  const actor = toStaffSourceActor(guard.user);
  const canManageFacebookMetadata = canManagePrivilegedSourceFields(
    guard.user.role,
  );

  if (!canManageFacebookMetadata && facebookProvided) {
    return { ok: false, error: PRIVILEGED_FIELDS_ERROR };
  }

  if (
    !authorizeSourceMutation(actor, {
      trustLevel: trustLevel || undefined,
      autoPublish: autoPublishProvided ? autoPublish : undefined,
      sourceType: sourceType || undefined,
      ...facebook,
      operation: "create",
    }).ok
  ) {
    return { ok: false, error: PRIVILEGED_FIELDS_ERROR };
  }

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
  if (formData.has("baseUrl")) {
    input.baseUrl = baseUrl || null;
  }
  if (trustLevel) input.trustLevel = trustLevel;
  if (autoPublishProvided) input.autoPublish = autoPublish;
  input.checkFrequencyMinutes = checkFrequencyMinutes;
  if (canManageFacebookMetadata && sourceType) {
    Object.assign(input, facebook);
  }

  try {
    const result = await updateSource(sourceId, input, actor);
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.code === "FORBIDDEN"
            ? PRIVILEGED_FIELDS_ERROR
            : GENERIC_ERROR,
      };
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
  const actor = toStaffSourceActor(guard.user);

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await deleteSource(sourceId, actor);
    if (!result.ok) {
      if (result.code === "FK_VIOLATION") {
        return { ok: false, error: GENERIC_FK_ERROR };
      }
      return {
        ok: false,
        error:
          result.code === "FORBIDDEN"
            ? LIFECYCLE_DENIED_ERROR
            : GENERIC_ERROR,
      };
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
  const actor = toStaffSourceActor(guard.user);

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await toggleSourceActive(sourceId, actor);
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.code === "FORBIDDEN"
            ? LIFECYCLE_DENIED_ERROR
            : GENERIC_ERROR,
      };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
