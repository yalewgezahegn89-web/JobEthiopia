/**
 * Cover letter database access + audit (Phase 13 — Career Tools).
 *
 * Cover letters are strictly candidate-owned: `candidateId` is always the
 * server-resolved session user id and every read/mutation is scoped to it.
 * There is no public listing query, and updating/deleting by id requires the
 * id AND the owning candidate id together, so one candidate can never address
 * another candidate's letter. Audit events record only an action label —
 * never letter content, position, or employer data.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateCoverLetters } from "@/db/schema/candidateCoverLetters";
import { auditLog } from "@/db/schema/auditLog";
import {
  coverLetterSchema,
  COVER_LETTER_TITLE_MAX,
  COVER_LETTERS_MAX,
  type CoverLetterInput,
} from "@/lib/validations/coverLetter";

export type CoverLetterRow = {
  id: string;
  candidateId: string;
  jobId: string | null;
  title: string;
  position: string;
  employer: string;
  recipient: string | null;
  location: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CoverLetterListItem = {
  id: string;
  jobId: string | null;
  title: string;
  position: string;
  employer: string;
  updatedAt: Date;
};

export type SaveCoverLetterResult =
  | { ok: true; row: CoverLetterRow; created: boolean }
  | { ok: false; code: "INVALID_INPUT" | "NOT_FOUND" | "LIMIT" };

export type DeleteCoverLetterResult =
  | { ok: true; deleted: boolean }
  | { ok: false; code: "NOT_FOUND" };

export type DuplicateCoverLetterResult =
  | { ok: true; row: CoverLetterRow }
  | { ok: false; code: "NOT_FOUND" | "LIMIT" };

export type SaveCoverLetterOptions = {
  existingId?: string | null;
  jobId?: string | null;
};

/**
 * Loads a candidate's own cover letter by id. Returns null when the letter
 * does not exist OR belongs to a different candidate (both cases deliberately
 * look identical so no existence is leaked across users).
 */
export async function getOwnedCoverLetter(
  candidateId: string,
  id: string,
): Promise<CoverLetterRow | null> {
  if (!candidateId || !id) return null;
  const row = await db.query.candidateCoverLetters.findFirst({
    where: and(
      eq(candidateCoverLetters.id, id),
      eq(candidateCoverLetters.candidateId, candidateId),
    ),
  });
  return row ?? null;
}

/**
 * Lists the candidate's own cover letters, most recently updated first.
 */
export async function listCoverLetters(
  candidateId: string,
): Promise<CoverLetterListItem[]> {
  if (!candidateId) return [];
  const rows = await db.query.candidateCoverLetters.findMany({
    where: eq(candidateCoverLetters.candidateId, candidateId),
    orderBy: desc(candidateCoverLetters.updatedAt),
    columns: {
      id: true,
      jobId: true,
      title: true,
      position: true,
      employer: true,
      updatedAt: true,
    },
  });
  return rows;
}

/**
 * Creates or updates the candidate's own cover letter inside a transaction
 * with a single audit event. Input must already be validated through
 * coverLetterSchema. `existingId` scopes updates to the owning candidate;
 * `jobId` is an optional reference kept for prefill/reuse.
 */
export async function saveCoverLetter(
  candidateId: string,
  input: CoverLetterInput,
  options: SaveCoverLetterOptions = {},
): Promise<SaveCoverLetterResult> {
  const parsed = coverLetterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    if (options.existingId) {
      const [updated] = await tx
        .update(candidateCoverLetters)
        .set({
          jobId: options.jobId ?? null,
          title: data.title,
          position: data.position,
          employer: data.employer,
          recipient: data.recipient,
          location: data.location,
          body: data.body,
        })
        .where(
          and(
            eq(candidateCoverLetters.id, options.existingId),
            eq(candidateCoverLetters.candidateId, candidateId),
          ),
        )
        .returning();

      if (!updated) return { code: "NOT_FOUND" as const, row: null };

      await tx.insert(auditLog).values({
        actorUserId: candidateId,
        action: "COVER_LETTER_UPDATED",
        targetType: "user",
        targetId: candidateId,
        metadata: { action: "updated" },
      });

      return { code: "OK" as const, row: updated, created: false as const };
    }

    const existing = await tx.query.candidateCoverLetters.findMany({
      where: eq(candidateCoverLetters.candidateId, candidateId),
      columns: { id: true },
      limit: COVER_LETTERS_MAX + 1,
    });
    if (existing.length > COVER_LETTERS_MAX) {
      return { code: "LIMIT" as const, row: null };
    }

    const [inserted] = await tx
      .insert(candidateCoverLetters)
      .values({
        candidateId,
        jobId: options.jobId ?? null,
        title: data.title,
        position: data.position,
        employer: data.employer,
        recipient: data.recipient,
        location: data.location,
        body: data.body,
      })
      .returning();

    await tx.insert(auditLog).values({
      actorUserId: candidateId,
      action: "COVER_LETTER_CREATED",
      targetType: "user",
      targetId: candidateId,
      metadata: { action: "created" },
    });

    return { code: "OK" as const, row: inserted, created: true as const };
  });

  if (result.code === "NOT_FOUND") return { ok: false, code: "NOT_FOUND" };
  if (result.code === "LIMIT") return { ok: false, code: "LIMIT" };
  return { ok: true, row: result.row, created: result.created };
}

/**
 * Duplicates one of the candidate's own letters as a fresh row (ownership
 * scoped), appending " (copy)" when it fits within the title limit.
 */
export async function duplicateCoverLetter(
  candidateId: string,
  id: string,
): Promise<DuplicateCoverLetterResult> {
  const result = await db.transaction(async (tx) => {
    const source = await tx.query.candidateCoverLetters.findFirst({
      where: and(
        eq(candidateCoverLetters.id, id),
        eq(candidateCoverLetters.candidateId, candidateId),
      ),
    });
    if (!source) return { code: "NOT_FOUND" as const, row: null };

    const existing = await tx.query.candidateCoverLetters.findMany({
      where: eq(candidateCoverLetters.candidateId, candidateId),
      columns: { id: true },
      limit: COVER_LETTERS_MAX + 1,
    });
    if (existing.length > COVER_LETTERS_MAX) {
      return { code: "LIMIT" as const, row: null };
    }

    const copyTitle = `${source.title} (copy)`.slice(0, COVER_LETTER_TITLE_MAX);

    const [inserted] = await tx
      .insert(candidateCoverLetters)
      .values({
        candidateId,
        jobId: source.jobId,
        title: copyTitle,
        position: source.position,
        employer: source.employer,
        recipient: source.recipient,
        location: source.location,
        body: source.body,
      })
      .returning();

    await tx.insert(auditLog).values({
      actorUserId: candidateId,
      action: "COVER_LETTER_DUPLICATED",
      targetType: "user",
      targetId: candidateId,
      metadata: { action: "duplicated" },
    });

    return { code: "OK" as const, row: inserted };
  });

  if (result.code === "NOT_FOUND") return { ok: false, code: "NOT_FOUND" };
  if (result.code === "LIMIT") return { ok: false, code: "LIMIT" };
  return { ok: true, row: result.row };
}

/**
 * Deletes one of the candidate's own cover letters (ownership scoped)
 * atomically with the COVER_LETTER_DELETED audit event.
 */
export async function deleteCoverLetter(
  candidateId: string,
  id: string,
): Promise<DeleteCoverLetterResult> {
  const result = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(candidateCoverLetters)
      .where(
        and(
          eq(candidateCoverLetters.id, id),
          eq(candidateCoverLetters.candidateId, candidateId),
        ),
      )
      .returning({ id: candidateCoverLetters.id });

    if (!deleted) return { deleted: false as const };

    await tx.insert(auditLog).values({
      actorUserId: candidateId,
      action: "COVER_LETTER_DELETED",
      targetType: "user",
      targetId: candidateId,
      metadata: { action: "deleted" },
    });

    return { deleted: true as const };
  });

  return { ok: true, deleted: result.deleted };
}