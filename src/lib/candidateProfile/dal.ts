/**
 * Candidate self-profile business logic (Batch 88).
 *
 * Identity is always the server-resolved candidate id passed from the verified
 * session; it is never taken from client input. The profile is private: there
 * is no global/public profile query and reads are scoped to a single candidate.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateProfiles } from "@/db/schema/candidateProfiles";
import { auditLog } from "@/db/schema/auditLog";
import type { CandidateProfileInput } from "@/lib/validations/candidateProfile";

export type CandidateProfile = {
  id: string;
  candidateId: string;
  phone: string | null;
  locationId: string | null;
  professionalSummary: string | null;
  totalExperienceYears: number | null;
  education: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateProfileResult =
  | { ok: true; profile: CandidateProfile; changes: string[] }
  | { ok: false; code: "INVALID_INPUT" };

function normalizeValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toProfile(
  row: NonNullable<Awaited<ReturnType<typeof getCandidateProfile>>>,
): CandidateProfile {
  return row;
}

/**
 * Loads the candidate's own profile. Returns null when none exists.
 * Scoped strictly to the given candidate id (derived from the session).
 */
export async function getCandidateProfile(
  candidateId: string,
): Promise<CandidateProfile | null> {
  if (!candidateId) return null;

  const row = await db.query.candidateProfiles.findFirst({
    where: eq(candidateProfiles.candidateId, candidateId),
  });

  if (!row) return null;

  return {
    id: row.id,
    candidateId: row.candidateId,
    phone: row.phone,
    locationId: row.locationId,
    professionalSummary: row.professionalSummary,
    totalExperienceYears: row.totalExperienceYears,
    education: row.education,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Creates (when absent) or updates (when present) the candidate's profile,
 * atomically with the PROFILE_UPDATED audit event. Only field names that
 * actually changed are recorded in the audit metadata; no PII values are ever
 * stored. createdAt is preserved on update; updatedAt changes automatically.
 */
export async function updateCandidateProfile(
  candidateId: string,
  input: CandidateProfileInput,
): Promise<UpdateProfileResult> {
  const phone = normalizePhoneInput(input.phone);
  const locationId = input.locationId;
  const professionalSummary = normalizeValue(input.professionalSummary);
  const totalExperienceYears =
    input.totalExperienceYears == null ? null : input.totalExperienceYears;
  const education = normalizeValue(input.education);

  const next = {
    phone,
    locationId,
    professionalSummary,
    totalExperienceYears,
    education,
  };

  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.candidateProfiles.findFirst({
      where: eq(candidateProfiles.candidateId, candidateId),
    });

    if (!existing) {
      const [inserted] = await tx
        .insert(candidateProfiles)
        .values({ candidateId, ...next })
        .returning();

      const changes = Object.keys(next).filter(
        (key) => next[key as keyof typeof next] != null,
      );

      await tx.insert(auditLog).values({
        actorUserId: candidateId,
        action: "PROFILE_UPDATED",
        targetType: "user",
        targetId: candidateId,
        metadata: { changes },
      });

      return { profile: toProfile(inserted), changes };
    }

    const changes: string[] = [];
    if (!isSame(existing.phone, next.phone)) changes.push("phone");
    if (!isSameLocation(existing.locationId, next.locationId))
      changes.push("locationId");
    if (!isSame(existing.professionalSummary, next.professionalSummary))
      changes.push("professionalSummary");
    if (!isSame(existing.totalExperienceYears, next.totalExperienceYears))
      changes.push("totalExperienceYears");
    if (!isSame(existing.education, next.education)) changes.push("education");

    const [updated] = await tx
      .update(candidateProfiles)
      .set(next)
      .where(eq(candidateProfiles.candidateId, candidateId))
      .returning();

    if (changes.length > 0) {
      await tx.insert(auditLog).values({
        actorUserId: candidateId,
        action: "PROFILE_UPDATED",
        targetType: "user",
        targetId: candidateId,
        metadata: { changes },
      });
    }

    return { profile: toProfile(updated), changes };
  });

  return { ok: true, ...result };
}

function normalizePhoneInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.replace(/[\s\-.]/g, "");
}

function isSame(a: string | number | null, b: string | number | null): boolean {
  return (a ?? null) === (b ?? null);
}

function isSameLocation(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || a === "") return b === null || b === "";
  if (b === null || b === "") return false;
  return a === b;
}

export type { CandidateProfileInput };
