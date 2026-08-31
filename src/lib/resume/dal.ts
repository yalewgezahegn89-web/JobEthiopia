/**
 * Resume database access + authorization (Batch 89).
 *
 * Resume metadata is stored per-application in `application_resumes`. Reads are
 * strictly authorization-gated: candidates only for their own application;
 * employers only when they are an active member of the organization that owns
 * the job, with role ORGANIZATION_ADMIN and an active organization. Identity is
 * always the server-resolved session user id; client-supplied candidate or
 * organization ids are never used as authority.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicationResumes } from "@/db/schema/applicationResumes";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { users } from "@/db/schema/users";
import { auditLog } from "@/db/schema/auditLog";

export type ResumeRecord = {
  id: string;
  applicationId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ResumeMetadata = Omit<ResumeRecord, "objectKey">;

export type UpsertApplicationResumeInput = {
  applicationId: string;
  candidateUserId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type UpsertResult =
  | {
      ok: true;
      record: ResumeRecord;
      isReplacement: boolean;
      previousObjectKey: string | null;
      auditAction: "uploaded" | "replaced";
    }
  | { ok: false; code: "NOT_FOUND" };

function toRecord(row: {
  id: string;
  applicationId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}): ResumeRecord {
  return {
    id: row.id,
    applicationId: row.applicationId,
    objectKey: row.objectKey,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Plain lookup by application. Used for internal checks after authorization. */
export async function getApplicationResume(
  applicationId: string,
): Promise<ResumeRecord | null> {
  const row = await db.query.applicationResumes.findFirst({
    where: eq(applicationResumes.applicationId, applicationId),
  });
  return row ? toRecord(row) : null;
}

/**
 * Returns the resume only when the application belongs to the candidate.
 * Returns null otherwise, without revealing that another application exists.
 */
export async function getOwnedCandidateResume(
  applicationId: string,
  candidateUserId: string,
): Promise<ResumeRecord | null> {
  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.candidateUserId, candidateUserId),
    ),
    columns: { id: true },
  });
  if (!app) return null;
  return getApplicationResume(applicationId);
}

/**
 * Returns the resume only when the employer is an active member of the
 * organization that owns the job, with role ORGANIZATION_ADMIN and an active
 * organization. Mirrors existing B80 employer authorization.
 */
export async function getEmployerApplicationResume(
  applicationId: string,
  employerUserId: string,
): Promise<ResumeRecord | null> {
  const row = await db
    .select({
      id: applicationResumes.id,
      applicationId: applicationResumes.applicationId,
      objectKey: applicationResumes.objectKey,
      originalName: applicationResumes.originalName,
      mimeType: applicationResumes.mimeType,
      size: applicationResumes.size,
      createdAt: applicationResumes.createdAt,
      updatedAt: applicationResumes.updatedAt,
      organizationId: jobs.organizationId,
    })
    .from(applicationResumes)
    .innerJoin(applications, eq(applications.id, applicationResumes.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applicationResumes.applicationId, applicationId))
    .limit(1);

  if (row.length === 0) return null;

  const r = row[0];

  const auth = await db
    .select({
      role: users.role,
      userActive: users.isActive,
      orgStatus: organizations.status,
      memberId: organizationMembers.id,
    })
    .from(users)
    .innerJoin(
      organizations,
      eq(organizations.id, r.organizationId),
    )
    .leftJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, r.organizationId),
        eq(organizationMembers.userId, employerUserId),
      ),
    )
    .where(eq(users.id, employerUserId))
    .limit(1);

  const a = auth[0];
  if (!a) return null;
  if (a.role !== "ORGANIZATION_ADMIN") return null;
  if (!a.userActive) return null;
  if (a.orgStatus !== "ACTIVE") return null;
  if (!a.memberId) return null;

  return {
    id: r.id,
    applicationId: r.applicationId,
    objectKey: r.objectKey,
    originalName: r.originalName,
    mimeType: r.mimeType,
    size: r.size,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Inserts (when absent) or updates (when present) the resume metadata row,
 * atomically with the RESUME_UPLOADED / RESUME_REPLACED audit event. The audit
 * event is written in the same transaction as the metadata write. No filename,
 * size, MIME, or object key is ever stored in audit metadata.
 */
export async function upsertApplicationResume(
  input: UpsertApplicationResumeInput,
): Promise<UpsertResult> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.applicationResumes.findFirst({
      where: eq(applicationResumes.applicationId, input.applicationId),
    });

    if (existing) {
      const [updated] = await tx
        .update(applicationResumes)
        .set({
          objectKey: input.objectKey,
          originalName: input.originalName,
          mimeType: input.mimeType,
          size: input.size,
        })
        .where(eq(applicationResumes.applicationId, input.applicationId))
        .returning();

      await tx.insert(auditLog).values({
        actorUserId: input.candidateUserId,
        action: "RESUME_REPLACED",
        targetType: "application",
        targetId: input.applicationId,
        metadata: { action: "replaced" },
      });

      return {
        ok: true,
        record: toRecord(updated!),
        isReplacement: true,
        previousObjectKey: existing.objectKey,
        auditAction: "replaced",
      };
    }

    const [inserted] = await tx
      .insert(applicationResumes)
      .values({
        applicationId: input.applicationId,
        objectKey: input.objectKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
      })
      .returning();

    await tx.insert(auditLog).values({
      actorUserId: input.candidateUserId,
      action: "RESUME_UPLOADED",
      targetType: "application",
      targetId: input.applicationId,
      metadata: { action: "uploaded" },
    });

    return {
      ok: true,
      record: toRecord(inserted!),
      isReplacement: false,
      previousObjectKey: null,
      auditAction: "uploaded",
    };
  });
}

/**
 * Deletes the resume metadata row atomically with the RESUME_DELETED audit
 * event, and returns the object key so the caller can delete the object after
 * the DB commit. Returns null when no resume exists for the application.
 */
export async function deleteApplicationResume(
  applicationId: string,
  candidateUserId: string,
): Promise<{ objectKey: string } | null> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.applicationResumes.findFirst({
      where: eq(applicationResumes.applicationId, applicationId),
      columns: { id: true, objectKey: true },
    });
    if (!existing) return null;

    await tx
      .delete(applicationResumes)
      .where(eq(applicationResumes.applicationId, applicationId));

    await tx.insert(auditLog).values({
      actorUserId: candidateUserId,
      action: "RESUME_DELETED",
      targetType: "application",
      targetId: applicationId,
      metadata: { action: "deleted" },
    });

    return { objectKey: existing.objectKey };
  });
}
