import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";

export type OrganizationSettings = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  websiteUrl: string | null;
};

/**
 * Returns organization settings for the settings page.
 * Only returns data for organizations the user is a member of.
 */
export async function getOrganizationForSettings(
  organizationId: string,
): Promise<OrganizationSettings | null> {
  if (!organizationId) return null;

  try {
    const row = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        industry: organizations.industry,
        websiteUrl: organizations.websiteUrl,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return row[0] ?? null;
  } catch {
    return null;
  }
}

export type UpdateOrganizationResult =
  | { ok: true; item: OrganizationSettings }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" };

/**
 * Updates organization profile settings.
 * Only allows updates to organizations the user is a member of.
 */
export async function updateOrganizationSettings(
  userId: string,
  organizationId: string,
  input: {
    name?: string;
    description?: string | null;
    industry?: string | null;
    websiteUrl?: string | null;
  },
): Promise<UpdateOrganizationResult> {
  if (!organizationId) return { ok: false, code: "NOT_FOUND" };

  // Verify the organization exists
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (existing.length === 0) return { ok: false, code: "NOT_FOUND" };

  // Validate name if provided
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0 || trimmed.length > 200) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.industry !== undefined) updateData.industry = input.industry?.trim() || null;
    if (input.websiteUrl !== undefined) updateData.websiteUrl = input.websiteUrl?.trim() || null;

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, organizationId))
      .returning({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        industry: organizations.industry,
        websiteUrl: organizations.websiteUrl,
      });

    if (!updated) return { ok: false, code: "NOT_FOUND" };

    return {
      ok: true,
      item: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        industry: updated.industry,
        websiteUrl: updated.websiteUrl,
      },
    };
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }
}
