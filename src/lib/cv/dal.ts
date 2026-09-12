/**
 * CV database access + audit (Batch 9 — Career / CV tools).
 *
 * The CV is strictly candidate-owned: `candidateId` is always the server-
 * resolved session user id and reads/mutations are scoped to it. There is no
 * public listing query and no way to address another user's CV by id. Audit
 * events record only an action label — never CV content, contact details, or
 * section data.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateCvs } from "@/db/schema/candidateCvs";
import { candidateCvExperiences } from "@/db/schema/candidateCvExperiences";
import { candidateCvEducations } from "@/db/schema/candidateCvEducations";
import { candidateCvSkills } from "@/db/schema/candidateCvSkills";
import { candidateCvCertifications } from "@/db/schema/candidateCvCertifications";
import { auditLog } from "@/db/schema/auditLog";
import type {
  CvInput,
  CvExperienceInput,
  CvEducationInput,
  CvSkillInput,
  CvCertificationInput,
} from "@/lib/validations/cv";

export type CvHeader = {
  id: string;
  candidateId: string;
  title: string;
  professionalSummary: string | null;
  phone: string | null;
  location: string | null;
  websiteUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CvExperience = CvExperienceInput & { id: string };
export type CvEducation = CvEducationInput & { id: string };
export type CvSkill = CvSkillInput & { id: string };
export type CvCertification = CvCertificationInput & { id: string };

export type CvAggregate = {
  header: CvHeader;
  experiences: CvExperience[];
  educations: CvEducation[];
  skills: CvSkill[];
  certifications: CvCertification[];
};

export type SaveCvResult =
  | { ok: true; cv: CvAggregate; created: boolean }
  | { ok: false; code: "INVALID_INPUT" };

export type DeleteCvResult =
  | { ok: true; deleted: boolean }
  | { ok: false; code: "NOT_FOUND" };

/**
 * Loads the candidate's own CV (header + all four sections). Returns null when
 * the candidate has no CV. Reads are scoped strictly to the given candidate id
 * derived from the session; another candidate's id always yields null.
 */
export async function getOwnedCv(
  candidateId: string,
): Promise<CvAggregate | null> {
  if (!candidateId) return null;

  const header = await db.query.candidateCvs.findFirst({
    where: eq(candidateCvs.candidateId, candidateId),
  });
  if (!header) return null;

  const [experiences, educations, skills, certifications] = await Promise.all([
    db.query.candidateCvExperiences.findMany({
      where: eq(candidateCvExperiences.cvId, header.id),
      orderBy: asc(candidateCvExperiences.createdAt),
    }),
    db.query.candidateCvEducations.findMany({
      where: eq(candidateCvEducations.cvId, header.id),
      orderBy: asc(candidateCvEducations.createdAt),
    }),
    db.query.candidateCvSkills.findMany({
      where: eq(candidateCvSkills.cvId, header.id),
      orderBy: asc(candidateCvSkills.createdAt),
    }),
    db.query.candidateCvCertifications.findMany({
      where: eq(candidateCvCertifications.cvId, header.id),
      orderBy: asc(candidateCvCertifications.createdAt),
    }),
  ]);

  return {
    header: toHeader(header),
    experiences: experiences.map(toExperience),
    educations: educations.map(toEducation),
    skills: skills.map(toSkill),
    certifications: certifications.map(toCertification),
  };
}

function toHeader(row: CvHeader): CvHeader {
  return row;
}

function toExperience(row: CvExperience): CvExperience {
  return row;
}

function toEducation(row: CvEducation): CvEducation {
  return row;
}

function toSkill(row: CvSkill): CvSkill {
  return row;
}

function toCertification(row: CvCertification): CvCertification {
  return row;
}

/**
 * Creates (when absent) or updates (when present) the candidate's CV in one
 * transaction, replacing all four section lists atomically. Emits a single
 * CV_CREATED or CV_UPDATED audit event with an action label only. `createdAt`
 * is preserved on update; `updatedAt` follows the row. Input must already be
 * validated through cvSchema.
 */
export async function saveCv(
  candidateId: string,
  input: CvInput,
): Promise<SaveCvResult> {
  const headerValues = {
    title: input.header.title,
    professionalSummary: input.header.professionalSummary,
    phone: input.header.phone,
    location: input.header.location,
    websiteUrl: input.header.websiteUrl,
  };

  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.candidateCvs.findFirst({
      where: eq(candidateCvs.candidateId, candidateId),
      columns: { id: true },
    });

    if (existing) {
      const [updated] = await tx
        .update(candidateCvs)
        .set(headerValues)
        .where(eq(candidateCvs.candidateId, candidateId))
        .returning();

      await tx.delete(candidateCvExperiences).where(eq(candidateCvExperiences.cvId, existing.id));
      await tx.delete(candidateCvEducations).where(eq(candidateCvEducations.cvId, existing.id));
      await tx.delete(candidateCvSkills).where(eq(candidateCvSkills.cvId, existing.id));
      await tx.delete(candidateCvCertifications).where(eq(candidateCvCertifications.cvId, existing.id));

      const [experiences, educations, skills, certifications] = await Promise.all([
        tx.insert(candidateCvExperiences)
          .values(sectionExperiences(existing.id, input))
          .returning(),
        tx.insert(candidateCvEducations)
          .values(sectionEducations(existing.id, input))
          .returning(),
        tx.insert(candidateCvSkills).values(sectionSkills(existing.id, input)).returning(),
        tx.insert(candidateCvCertifications)
          .values(sectionCertifications(existing.id, input))
          .returning(),
      ]);

      await tx.insert(auditLog).values({
        actorUserId: candidateId,
        action: "CV_UPDATED",
        targetType: "user",
        targetId: candidateId,
        metadata: { action: "updated" },
      });

      return {
        created: false as const,
        cv: {
          header: toHeader(updated!),
          experiences: experiences.map(toExperience),
          educations: educations.map(toEducation),
          skills: skills.map(toSkill),
          certifications: certifications.map(toCertification),
        },
      };
    }

    const [inserted] = await tx
      .insert(candidateCvs)
      .values({ candidateId, ...headerValues })
      .returning();

    const [experiences, educations, skills, certifications] = await Promise.all([
      tx.insert(candidateCvExperiences)
        .values(sectionExperiences(inserted.id, input))
        .returning(),
      tx.insert(candidateCvEducations)
        .values(sectionEducations(inserted.id, input))
        .returning(),
      tx.insert(candidateCvSkills).values(sectionSkills(inserted.id, input)).returning(),
      tx.insert(candidateCvCertifications)
        .values(sectionCertifications(inserted.id, input))
        .returning(),
    ]);

    await tx.insert(auditLog).values({
      actorUserId: candidateId,
      action: "CV_CREATED",
      targetType: "user",
      targetId: candidateId,
      metadata: { action: "created" },
    });

    return {
      created: true as const,
      cv: {
        header: toHeader(inserted),
        experiences: experiences.map(toExperience),
        educations: educations.map(toEducation),
        skills: skills.map(toSkill),
        certifications: certifications.map(toCertification),
      },
    };
  });

  return { ok: true, created: result.created, cv: result.cv };
}

/**
 * Deletes the candidate's CV (cascade removes section rows) atomically with
 * the CV_DELETED audit event. Returns deleted=false when no CV exists.
 */
export async function deleteCv(
  candidateId: string,
): Promise<DeleteCvResult> {
  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.candidateCvs.findFirst({
      where: eq(candidateCvs.candidateId, candidateId),
      columns: { id: true },
    });

    if (!existing) return { deleted: false as const };

    await tx.delete(candidateCvs).where(eq(candidateCvs.id, existing.id));

    await tx.insert(auditLog).values({
      actorUserId: candidateId,
      action: "CV_DELETED",
      targetType: "user",
      targetId: candidateId,
      metadata: { action: "deleted" },
    });

    return { deleted: true as const };
  });

  return { ok: true, deleted: result.deleted };
}

function sectionExperiences(cvId: string, input: CvInput) {
  return input.experiences.map((x: CvExperienceInput) => ({
    cvId,
    employer: x.employer,
    role: x.role,
    location: x.location,
    startMonth: x.startMonth,
    endMonth: x.endMonth,
    description: x.description,
  }));
}

function sectionEducations(cvId: string, input: CvInput) {
  return input.educations.map((x: CvEducationInput) => ({
    cvId,
    institution: x.institution,
    qualification: x.qualification,
    fieldOfStudy: x.fieldOfStudy,
    startMonth: x.startMonth,
    endMonth: x.endMonth,
  }));
}

function sectionSkills(cvId: string, input: CvInput) {
  return input.skills.map((x: CvSkillInput) => ({ cvId, name: x.name, level: x.level }));
}

function sectionCertifications(cvId: string, input: CvInput) {
  return input.certifications.map((x: CvCertificationInput) => ({
    cvId,
    name: x.name,
    issuer: x.issuer,
    issuedMonth: x.issuedMonth,
    credentialUrl: x.credentialUrl,
  }));
}