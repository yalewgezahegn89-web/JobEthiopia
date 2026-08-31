/**
 * Admin employer-onboarding-request helpers (Batch 97).
 *
 * Narrowly-scoped server-side data access for the staff approval/rejection
 * workflow. Every function assumes the caller has already performed session
 * authentication and role authorization (see the admin server actions / pages).
 *
 * Approval runs as ONE atomic transaction:
 *   CAS-claim the PENDING request -> insert the organization -> insert the
 *   membership -> promote the user to ORGANIZATION_ADMIN -> write audit rows
 *   -> mark the request APPROVED. Any failure rolls the whole transaction back.
 *
 * Identity, role, and organization state are never taken from client input;
 * the request row is the sole source of the organization attributes.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { auditLog } from "@/db/schema/auditLog";
import { employerOnboardingRequests } from "@/db/schema/employerOnboardingRequests";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export type EmployerOnboardingRequestSummary = {
  id: string;
  organizationName: string;
  organizationSlug: string;
  industry: string | null;
  status: string;
  createdAt: string;
};

export type EmployerOnboardingRequestAdminPaginated = {
  items: EmployerOnboardingRequestSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EmployerOnboardingRequestDetail = {
  id: string;
  userId: string;
  organizationName: string;
  organizationSlug: string;
  industry: string | null;
  description: string | null;
  websiteUrl: string | null;
  contactPhone: string | null;
  locationId: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  submitterEmail: string | null;
  submitterName: string | null;
};

/**
 * Returns the employer onboarding request admin list, newest first, paginated.
 */
export async function listEmployerOnboardingRequests(input: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<EmployerOnboardingRequestAdminPaginated> {
  const page = Math.max(
    1,
    Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20,
    ),
  );
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (
    input.status === "PENDING" ||
    input.status === "APPROVED" ||
    input.status === "REJECTED"
  ) {
    filters.push(eq(employerOnboardingRequests.status, input.status));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.employerOnboardingRequests.findMany({
      where,
      orderBy: [desc(employerOnboardingRequests.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        organizationName: true,
        organizationSlug: true,
        industry: true,
        status: true,
        createdAt: true,
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(employerOnboardingRequests)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;
  return {
    items: rows.map((r) => ({
      id: r.id,
      organizationName: r.organizationName,
      organizationSlug: r.organizationSlug,
      industry: r.industry,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Loads a single employer onboarding request with submitter info, or null.
 */
export async function getEmployerOnboardingRequest(
  id: string,
): Promise<EmployerOnboardingRequestDetail | null> {
  if (!isValidUuid(id)) return null;

  const request = await db.query.employerOnboardingRequests.findFirst({
    where: eq(employerOnboardingRequests.id, id),
  });
  if (!request) return null;

  let submitterEmail: string | null = null;
  let submitterName: string | null = null;
  if (request.userId) {
    const submitter = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);
    if (submitter[0]) {
      submitterEmail = submitter[0].email;
      submitterName = submitter[0].name;
    }
  }

  return {
    id: request.id,
    userId: request.userId,
    organizationName: request.organizationName,
    organizationSlug: request.organizationSlug,
    industry: request.industry,
    description: request.description,
    websiteUrl: request.websiteUrl,
    contactPhone: request.contactPhone,
    locationId: request.locationId,
    status: request.status,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    submitterEmail,
    submitterName,
  };
}

export type ApproveEmployerOnboardingResult =
  | { ok: true; organizationId: string }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATE" | "ERROR" };

/**
 * Approves a PENDING employer onboarding request and activates the employer
 * account. Runs as a single atomic transaction; the CAS claim on the request's
 * status line makes double-processing safe (only one transaction wins).
 */
export async function approveEmployerOnboarding(
  actorUserId: string,
  requestId: string,
): Promise<ApproveEmployerOnboardingResult> {
  if (!isValidUuid(requestId) || !isValidUuid(actorUserId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const request = await tx.query.employerOnboardingRequests.findFirst({
        where: eq(employerOnboardingRequests.id, requestId),
        columns: {
          id: true,
          userId: true,
          organizationName: true,
          organizationSlug: true,
          industry: true,
          description: true,
          websiteUrl: true,
          contactPhone: true,
          locationId: true,
          status: true,
        },
      });
      if (!request) return { ok: false as const, code: "NOT_FOUND" as const };
      if (request.status !== "PENDING") {
        return { ok: false as const, code: "INVALID_STATE" as const };
      }

      const user = await tx
        .select({ id: users.id, role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      const submitter = user[0];
      if (!submitter || submitter.role !== "CANDIDATE" || !submitter.isActive) {
        return { ok: false as const, code: "INVALID_STATE" as const };
      }

      const now = new Date();

      // CAS-claim: only one transaction can flip a row from PENDING.
      const [claim] = await tx
        .update(employerOnboardingRequests)
        .set({ status: "APPROVED", reviewedBy: actorUserId, reviewedAt: now })
        .where(
          and(
            eq(employerOnboardingRequests.id, requestId),
            eq(employerOnboardingRequests.status, "PENDING"),
          ),
        )
        .returning({ id: employerOnboardingRequests.id });
      if (!claim) {
        return { ok: false as const, code: "INVALID_STATE" as const };
      }

      const [org] = await tx
        .insert(organizations)
        .values({
          name: request.organizationName,
          slug: request.organizationSlug,
          industry: request.industry,
          description: request.description,
          websiteUrl: request.websiteUrl,
          locationId: request.locationId,
          isVerified: false,
          status: "ACTIVE",
        })
        .returning({ id: organizations.id });

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: request.userId,
      });

      await tx
        .update(users)
        .set({ role: "ORGANIZATION_ADMIN" })
        .where(eq(users.id, request.userId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "EMPLOYER_ONBOARDING_APPROVED",
        targetType: "employer_onboarding_request",
        targetId: requestId,
        metadata: {},
      });
      await tx.insert(auditLog).values({
        actorUserId,
        action: "ORGANIZATION_CREATED",
        targetType: "organization",
        targetId: org.id,
        metadata: { fromStatus: "REQUEST", toStatus: "ACTIVE" },
      });
      await tx.insert(auditLog).values({
        actorUserId,
        action: "ORGANIZATION_MEMBER_ADDED",
        targetType: "organization_member",
        targetId: org.id,
        metadata: { organizationId: org.id, userId: request.userId },
      });
      await tx.insert(auditLog).values({
        actorUserId,
        action: "USER_ROLE_CHANGED",
        targetType: "user",
        targetId: request.userId,
        metadata: { fromRole: "CANDIDATE", toRole: "ORGANIZATION_ADMIN" },
      });

      return { ok: true as const, organizationId: org.id };
    });

    return result;
  } catch {
    return { ok: false, code: "ERROR" };
  }
}

export type RejectEmployerOnboardingResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATE" | "ERROR" };

/**
 * Rejects a PENDING employer onboarding request. The submitter keeps their
 * account but stays CANDIDATE; no organization, membership, or role change is
 * made. Single atomic transaction with a CAS claim on the request's status.
 */
export async function rejectEmployerOnboarding(
  actorUserId: string,
  requestId: string,
  reviewNotes?: string,
): Promise<RejectEmployerOnboardingResult> {
  if (!isValidUuid(requestId) || !isValidUuid(actorUserId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const [claim] = await tx
        .update(employerOnboardingRequests)
        .set({
          status: "REJECTED",
          reviewedBy: actorUserId,
          reviewedAt: now,
          reviewNotes: reviewNotes?.trim() ? reviewNotes.trim() : null,
        })
        .where(
          and(
            eq(employerOnboardingRequests.id, requestId),
            eq(employerOnboardingRequests.status, "PENDING"),
          ),
        )
        .returning({ organizationSlug: employerOnboardingRequests.organizationSlug });

      if (!claim) {
        // Either the request does not exist or it is no longer pending.
        const exists = await tx.query.employerOnboardingRequests.findFirst({
          where: eq(employerOnboardingRequests.id, requestId),
          columns: { id: true },
        });
        if (!exists) return { ok: false as const, code: "NOT_FOUND" as const };
        return { ok: false as const, code: "INVALID_STATE" as const };
      }

      await tx.insert(auditLog).values({
        actorUserId,
        action: "EMPLOYER_ONBOARDING_REJECTED",
        targetType: "employer_onboarding_request",
        targetId: requestId,
        metadata: { reason: reviewNotes?.trim() ? reviewNotes.trim() : null },
      });

      return { ok: true as const };
    });

    return result;
  } catch {
    return { ok: false, code: "ERROR" };
  }
}
