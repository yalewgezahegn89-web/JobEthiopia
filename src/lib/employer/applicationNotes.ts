/**
 * Employer application notes business logic (Batch 92).
 *
 * Notes are PRIVATE EMPLOYER WORKFLOW DATA. They are internal screening and
 * collaboration records attached to an application and scoped to the
 * organization that owns that application (application -> job -> organization).
 *
 * Identity is never taken from client input: `actorUserId` is resolved from the
 * verified session at the route boundary, and the authorized organization is
 * resolved from the database. Client-supplied author/organization/candidate ids
 * are never accepted for authority decisions.
 *
 * Each mutating operation and its audit event are atomic within a transaction.
 * An employer may only edit/delete notes they authored; everyone may read all
 * notes within the organization's applications.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { auditLog } from "@/db/schema/auditLog";
import { applicationNotes } from "@/db/schema/applicationNotes";

const ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN";
const NOTES_LIMIT = 100;

export type ApplicationNote = {
  id: string;
  applicationId: string;
  authorUserId: string | null;
  authorName: string | null;
  authorActive: boolean | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteAccessResult =
  | { ok: true; organizationId: string }
  | { ok: false; code: "APPLICATION_NOT_FOUND" | "EMPLOYER_NOT_AUTHORIZED" | "ORGANIZATION_INACTIVE" };

export type NoteResult<T> =
  | { ok: true; item: T }
  | { ok: false; code: string };

/**
 * Resolves the organization that owns an application, purely from the database
 * (application -> job -> organization). Returns null when any part is missing.
 * A client-supplied organizationId is never trusted.
 */
export async function resolveEmployerApplicationOrganization(
  applicationId: string,
): Promise<{
  applicationId: string;
  jobId: string;
  organizationId: string;
  organizationStatus: string;
} | null> {
  const rows = await db
    .select({
      applicationId: applications.id,
      jobId: applications.jobId,
      organizationId: jobs.organizationId,
      organizationStatus: organizations.status,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
    .where(eq(applications.id, applicationId))
    .limit(1);

  return rows.length === 0 ? null : rows[0];
}

/**
 * Authorizes an employer actor to read/write notes for the given application.
 *
 * Checks, in order: actor exists & active & ORGANIZATION_ADMIN; the application
 * exists (and thus belongs to an organization); the organization is ACTIVE; the
 * actor is an organization_members member of that organization.
 *
 * Returns a safe context ({organizationId}) on success, or a stable error code.
 * Missing/cross-org applications resolve to APPLICATION_NOT_FOUND so that
 * whether an application belongs to another organization is never leaked.
 */
export async function assertEmployerApplicationNoteAccess(
  actorUserId: string,
  applicationId: string,
): Promise<NoteAccessResult> {
  const actorRow = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);

  if (
    actorRow.length === 0 ||
    actorRow[0].role !== ORGANIZATION_ADMIN ||
    !actorRow[0].isActive
  ) {
    return { ok: false, code: "EMPLOYER_NOT_AUTHORIZED" };
  }

  const context = await resolveEmployerApplicationOrganization(applicationId);
  if (!context) {
    return { ok: false, code: "APPLICATION_NOT_FOUND" };
  }

  if (context.organizationStatus !== "ACTIVE") {
    return { ok: false, code: "ORGANIZATION_INACTIVE" };
  }

  const membership = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, actorUserId),
        eq(organizationMembers.organizationId, context.organizationId),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    return { ok: false, code: "EMPLOYER_NOT_AUTHORIZED" };
  }

  return { ok: true, organizationId: context.organizationId };
}

/**
 * Lists the internal notes for an application (newest first, bounded). Only call
 * after employer authorization has been validated. Returns author identity
 * fields only; no candidate data is ever included.
 */
export async function listApplicationNotes(
  actorUserId: string,
  applicationId: string,
): Promise<NoteResult<ApplicationNote[]>> {
  const access = await assertEmployerApplicationNoteAccess(actorUserId, applicationId);
  if (!access.ok) return { ok: false, code: access.code };

  const rows = await db
    .select({
      id: applicationNotes.id,
      applicationId: applicationNotes.applicationId,
      authorUserId: applicationNotes.authorUserId,
      authorName: users.name,
      authorActive: users.isActive,
      body: applicationNotes.body,
      createdAt: applicationNotes.createdAt,
      updatedAt: applicationNotes.updatedAt,
    })
    .from(applicationNotes)
    .leftJoin(users, eq(users.id, applicationNotes.authorUserId))
    .where(eq(applicationNotes.applicationId, applicationId))
    .orderBy(desc(applicationNotes.createdAt))
    .limit(NOTES_LIMIT);

  return {
    ok: true,
    item: rows.map((r) => ({
      id: r.id,
      applicationId: r.applicationId,
      authorUserId: r.authorUserId,
      authorName: r.authorName,
      authorActive: r.authorActive ?? null,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

/**
 * Creates a note for the application on behalf of the authorized actor, atomically
 * with the APPLICATION_NOTE_CREATED audit event. authorUserId always comes from
 * the session; any client-supplied author id is ignored.
 */
export async function createApplicationNote(
  actorUserId: string,
  applicationId: string,
  body: string,
): Promise<NoteResult<ApplicationNote>> {
  const access = await assertEmployerApplicationNoteAccess(actorUserId, applicationId);
  if (!access.ok) return { ok: false, code: access.code };

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(applicationNotes)
        .values({ applicationId, authorUserId: actorUserId, body })
        .returning({
          id: applicationNotes.id,
          applicationId: applicationNotes.applicationId,
          authorUserId: applicationNotes.authorUserId,
          body: applicationNotes.body,
          createdAt: applicationNotes.createdAt,
          updatedAt: applicationNotes.updatedAt,
        });

      if (!created) return { ok: false as const, code: "NOTE_CREATE_FAILED" as const };

      await tx.insert(auditLog).values({
        actorUserId,
        action: "APPLICATION_NOTE_CREATED",
        targetType: "application_note",
        targetId: created.id,
        metadata: { applicationId, noteId: created.id },
      });

      return {
        ok: true as const,
        item: {
          id: created.id,
          applicationId: created.applicationId,
          authorUserId: created.authorUserId,
          authorName: null,
          authorActive: null,
          body: created.body,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      };
    });
  } catch {
    return { ok: false, code: "NOTE_CREATE_FAILED" };
  }
}

/**
 * Updates the body of a note the actor authored, atomically with the
 * APPLICATION_NOTE_UPDATED audit event. The note must belong to the given
 * application AND the actor must be its author.
 */
export async function updateApplicationNote(
  actorUserId: string,
  applicationId: string,
  noteId: string,
  body: string,
): Promise<NoteResult<ApplicationNote>> {
  const access = await assertEmployerApplicationNoteAccess(actorUserId, applicationId);
  if (!access.ok) return { ok: false, code: access.code };

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: applicationNotes.id,
          applicationId: applicationNotes.applicationId,
          authorUserId: applicationNotes.authorUserId,
        })
        .from(applicationNotes)
        .where(
          and(
            eq(applicationNotes.id, noteId),
            eq(applicationNotes.applicationId, applicationId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        return { ok: false as const, code: "NOTE_NOT_FOUND" as const };
      }

      if (existing[0].authorUserId !== actorUserId) {
        return { ok: false as const, code: "NOTE_NOT_OWNED" as const };
      }

      const [updated] = await tx
        .update(applicationNotes)
        .set({ body, updatedAt: new Date() })
        .where(eq(applicationNotes.id, noteId))
        .returning({
          id: applicationNotes.id,
          applicationId: applicationNotes.applicationId,
          authorUserId: applicationNotes.authorUserId,
          body: applicationNotes.body,
          createdAt: applicationNotes.createdAt,
          updatedAt: applicationNotes.updatedAt,
        });

      if (!updated) return { ok: false as const, code: "NOTE_NOT_FOUND" as const };

      await tx.insert(auditLog).values({
        actorUserId,
        action: "APPLICATION_NOTE_UPDATED",
        targetType: "application_note",
        targetId: noteId,
        metadata: { applicationId, noteId },
      });

      return {
        ok: true as const,
        item: {
          id: updated.id,
          applicationId: updated.applicationId,
          authorUserId: updated.authorUserId,
          authorName: null,
          authorActive: null,
          body: updated.body,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      };
    });
  } catch {
    return { ok: false, code: "NOTE_UPDATE_FAILED" };
  }
}

/**
 * Deletes a note the actor authored, atomically with the
 * APPLICATION_NOTE_DELETED audit event. The note must belong to the given
 * application AND the actor must be its author.
 */
export async function deleteApplicationNote(
  actorUserId: string,
  applicationId: string,
  noteId: string,
): Promise<{ ok: true; removed: true } | { ok: false; code: string }> {
  const access = await assertEmployerApplicationNoteAccess(actorUserId, applicationId);
  if (!access.ok) return { ok: false, code: access.code };

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: applicationNotes.id,
          applicationId: applicationNotes.applicationId,
          authorUserId: applicationNotes.authorUserId,
        })
        .from(applicationNotes)
        .where(
          and(
            eq(applicationNotes.id, noteId),
            eq(applicationNotes.applicationId, applicationId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        return { ok: false as const, code: "NOTE_NOT_FOUND" as const };
      }

      if (existing[0].authorUserId !== actorUserId) {
        return { ok: false as const, code: "NOTE_NOT_OWNED" as const };
      }

      await tx
        .delete(applicationNotes)
        .where(eq(applicationNotes.id, noteId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "APPLICATION_NOTE_DELETED",
        targetType: "application_note",
        targetId: noteId,
        metadata: { applicationId, noteId },
      });

      return { ok: true as const, removed: true as const };
    });
  } catch {
    return { ok: false, code: "NOTE_DELETE_FAILED" };
  }
}
