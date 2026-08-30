"use server";

/**
 * Admin taxonomy management server actions (Batch 71).
 *
 * Security order enforced in every action:
 *   1. Authenticate the session
 *   2. Authorize the role (staff only for view, SUPER_ADMIN/ADMIN for mutate)
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
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  createProfession,
  updateProfession,
  deleteProfession,
  toggleProfessionActive,
  createLocation,
  updateLocation,
  deleteLocation,
  toggleLocationActive,
} from "@/lib/admin/taxonomy";

export type TaxonomyActionResult = {
  ok: boolean;
  error?: string;
  redirect?: string;
};

const GENERIC_ERROR = "Unable to complete this action. Please try again.";
const UNAUTHORIZED_ERROR = "You do not have permission to perform this action.";
const CYCLE_ERROR = "This parent assignment would create a cycle.";
const SELF_PARENT_ERROR = "An item cannot be its own parent.";

function isMutator(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

export async function createCategoryAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const parentId = String(formData.get("parentId") ?? "").trim() || undefined;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!name || !slug) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await createCategory(
      {
        name,
        slug,
        description: description || null,
        parentId: parentId || null,
        sortOrder,
      },
      guard.user.id,
    );

    if (!result.ok) {
      if (result.code === "DUPLICATE") {
        return { ok: false, error: "A category with this slug already exists." };
      }
      if (result.code === "VALIDATION") {
        return { ok: false, error: "Invalid input. Please check your entries." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }

    return { ok: true, redirect: `/admin/taxonomy/categories/${result.id}` };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateCategoryAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
  if (slug) input.slug = slug;
  if (description !== undefined) input.description = description || null;
  if (parentId !== undefined) input.parentId = parentId || null;
  if (sortOrder !== undefined) input.sortOrder = sortOrder;

  try {
    const result = await updateCategory(id, input, guard.user.id);
    if (!result.ok) {
      if (result.code === "CYCLE") {
        return { ok: false, error: CYCLE_ERROR };
      }
      if (result.code === "SELF_PARENT") {
        return { ok: false, error: SELF_PARENT_ERROR };
      }
      if (result.code === "DUPLICATE") {
        return { ok: false, error: "A category with this slug already exists." };
      }
      if (result.code === "VALIDATION") {
        return { ok: false, error: "Invalid input. Please check your entries." };
      }
      if (result.code === "NOT_FOUND") {
        return { ok: false, error: GENERIC_ERROR };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function deleteCategoryAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("categoryId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await deleteCategory(id, guard.user.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, redirect: "/admin/taxonomy/categories" };
}

export async function toggleCategoryActiveAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("categoryId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await toggleCategoryActive(id, guard.user.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Professions                                                               */
/* -------------------------------------------------------------------------- */

export async function createProfessionAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || undefined;

  if (!name || !slug) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await createProfession(
      {
        name,
        slug,
        description: description || null,
        categoryId: categoryId || null,
      },
      guard.user.id,
    );

    if (!result.ok) {
      if (result.code === "DUPLICATE") {
        return { ok: false, error: "A profession with this slug already exists." };
      }
      if (result.code === "VALIDATION") {
        return { ok: false, error: "Invalid input. Please check your entries." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }

    return { ok: true, redirect: `/admin/taxonomy/professions/${result.id}` };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateProfessionAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("professionId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
  if (slug) input.slug = slug;
  if (description !== undefined) input.description = description || null;
  if (categoryId !== undefined) input.categoryId = categoryId || null;

  try {
    const result = await updateProfession(id, input, guard.user.id);
    if (!result.ok) {
      if (result.code === "DUPLICATE") {
        return { ok: false, error: "A profession with this slug already exists." };
      }
      if (result.code === "VALIDATION") {
        return { ok: false, error: "Invalid input. Please check your entries." };
      }
      if (result.code === "NOT_FOUND") {
        return { ok: false, error: GENERIC_ERROR };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function deleteProfessionAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("professionId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await deleteProfession(id, guard.user.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, redirect: "/admin/taxonomy/professions" };
}

export async function toggleProfessionActiveAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("professionId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await toggleProfessionActive(id, guard.user.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Locations                                                                 */
/* -------------------------------------------------------------------------- */

export async function createLocationAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim() || undefined;
  const latitudeStr = String(formData.get("latitude") ?? "").trim();
  const longitudeStr = String(formData.get("longitude") ?? "").trim();

  if (!name || !slug || !type) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const latitude = latitudeStr ? Number(latitudeStr) : null;
    const longitude = longitudeStr ? Number(longitudeStr) : null;

    const result = await createLocation(
      {
        name,
        slug,
        type,
        parentId: parentId || null,
        latitude,
        longitude,
      },
      guard.user.id,
    );

    if (!result.ok) {
      if (result.code === "DUPLICATE") {
        return { ok: false, error: "A location with this slug already exists." };
      }
      if (result.code === "VALIDATION") {
        return { ok: false, error: "Invalid input. Please check your entries." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }

    return { ok: true, redirect: `/admin/taxonomy/locations/${result.id}` };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateLocationAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("locationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const latitudeStr = String(formData.get("latitude") ?? "").trim();
  const longitudeStr = String(formData.get("longitude") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
  if (slug) input.slug = slug;
  if (type) input.type = type;
  if (parentId !== undefined) input.parentId = parentId || null;
  if (latitudeStr !== undefined) input.latitude = latitudeStr ? Number(latitudeStr) : null;
  if (longitudeStr !== undefined) input.longitude = longitudeStr ? Number(longitudeStr) : null;

  try {
    const result = await updateLocation(id, input, guard.user.id);
    if (!result.ok) {
      if (result.code === "CYCLE") {
        return { ok: false, error: CYCLE_ERROR };
      }
      if (result.code === "SELF_PARENT") {
        return { ok: false, error: SELF_PARENT_ERROR };
      }
      if (result.code === "DUPLICATE") {
        return { ok: false, error: "A location with this slug already exists." };
      }
      if (result.code === "VALIDATION") {
        return { ok: false, error: "Invalid input. Please check your entries." };
      }
      if (result.code === "NOT_FOUND") {
        return { ok: false, error: GENERIC_ERROR };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function deleteLocationAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("locationId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await deleteLocation(id, guard.user.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, redirect: "/admin/taxonomy/locations" };
}

export async function toggleLocationActiveAction(
  _prevState: TaxonomyActionResult,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  const id = String(formData.get("locationId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/taxonomy");
  }

  if (!isMutator(guard.user.role)) {
    return { ok: false, error: UNAUTHORIZED_ERROR };
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
    const result = await toggleLocationActive(id, guard.user.id);
    if (!result.ok) {
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
