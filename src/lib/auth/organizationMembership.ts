import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema/organizationMembers";

/**
 * Returns all organization IDs that the given user is a member of.
 */
export async function getUserOrganizationIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));

  return rows.map((r) => r.organizationId);
}

/**
 * Checks whether the user is a member of the given organization.
 */
export async function isOrganizationMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const row = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
    ),
    columns: { id: true },
  });

  return !!row;
}

/**
 * Throws if the user is not a member of the organization.
 * Returns void on success.
 */
export async function requireOrganizationMembership(
  userId: string,
  organizationId: string,
): Promise<void> {
  const member = await isOrganizationMember(userId, organizationId);
  if (!member) {
    throw new Error("Not a member of this organization");
  }
}
