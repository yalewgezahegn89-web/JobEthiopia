"use server";

import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { toggleUserActive, revokeUserSessions, changeUserRole } from "@/lib/admin/users";
import type { UserRole } from "@/lib/auth/roles";

export type UserActionResult = {
  ok: boolean;
  error?: string;
};

const GENERIC_ERROR = "Unable to update this user. Please try again.";

export async function toggleUserActiveAction(
  _prevState: UserActionResult,
  formData: FormData,
): Promise<UserActionResult> {
  const targetId = String(formData.get("targetId") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/users");
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
    const result = await toggleUserActive(targetId, actor.id, actor.role);
    if (!result.ok) {
      if (result.code === "SELF_DEACTIVATION") {
        return { ok: false, error: "You cannot deactivate your own account." };
      }
      if (result.code === "LAST_SUPER_ADMIN") {
        return {
          ok: false,
          error: "Cannot deactivate the last active SUPER_ADMIN account.",
        };
      }
      if (result.code === "UNAUTHORIZED") {
        return {
          ok: false,
          error: "You do not have permission to change user activation status.",
        };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function revokeUserSessionsAction(
  _prevState: UserActionResult,
  formData: FormData,
): Promise<UserActionResult> {
  const targetId = String(formData.get("targetId") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/users");
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
    const result = await revokeUserSessions(targetId, actor.id);
    if (!result.ok) {
      if (result.code === "SELF_FORCE_LOGOUT") {
        return { ok: false, error: "You cannot force-logout your own session." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

const ALLOWED_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ORGANIZATION_ADMIN",
  "CANDIDATE",
];

export async function changeUserRoleAction(
  _prevState: UserActionResult,
  formData: FormData,
): Promise<UserActionResult> {
  const targetId = String(formData.get("targetId") ?? "");
  const requestedRole = String(formData.get("role") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/users");
  }
  const actor = guard.user;

  if (actor.role !== "SUPER_ADMIN") {
    return {
      ok: false,
      error: "You do not have permission to change user roles.",
    };
  }

  if (!(ALLOWED_ROLES as readonly string[]).includes(requestedRole)) {
    return { ok: false, error: "Invalid role selected." };
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
    const result = await changeUserRole(targetId, requestedRole as UserRole, actor.id);
    if (!result.ok) {
      if (result.code === "SELF_CHANGE") {
        return { ok: false, error: "You cannot change your own role." };
      }
      if (result.code === "LAST_SUPER_ADMIN") {
        return {
          ok: false,
          error: "Cannot demote the last active SUPER_ADMIN account.",
        };
      }
      if (result.code === "UNAUTHORIZED") {
        return {
          ok: false,
          error: "You do not have permission to change user roles.",
        };
      }
      if (result.code === "INVALID_ROLE") {
        return { ok: false, error: "Invalid role selected." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
