import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { applications } from "@/db/schema/applications";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { users } from "@/db/schema/users";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { auditLog } from "@/db/schema/auditLog";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import { generateSlug } from "@/lib/ingestion/slug";

type JobStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED";

const VALID_EMPLOYER_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "REMOVED"],
  PENDING_REVIEW: ["DRAFT", "REMOVED"],
  PUBLISHED: [],
  EXPIRED: [],
  REMOVED: [],
};

const EDITABLE_STATUSES = ["DRAFT", "PENDING_REVIEW"] as const;
const REMOVABLE_STATUSES = ["DRAFT", "PENDING_REVIEW"] as const;

const MAX_SLUG_RETRIES = 10;

export type EmployerJobListItem = {
  id: string;
  title: string;
  organizationId: string;
  organizationName: string;
  status: JobStatus;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  applicationCount: number;
  needsReviewCount: number;
};

export type EmployerJobList = {
  items: EmployerJobListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EmployerJobDetail = {
  id: string;
  title: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  educationRequirements: string | null;
  benefits: string | null;
  categoryId: string | null;
  categoryName: string | null;
  professionId: string | null;
  professionName: string | null;
  locationId: string | null;
  locationName: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  employmentType: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  deadline: Date | null;
  applicationUrl: string | null;
  postedAt: Date | null;
  status: JobStatus;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateEmployerJobResult =
  | { ok: true; item: EmployerJobDetail }
  | { ok: false; code: "FORBIDDEN" | "ORG_INACTIVE" | "USER_INACTIVE" | "SLUG_COLLISION" };

export type UpdateEmployerJobResult =
  | { ok: true; item: { id: string; updatedAt: Date } }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "STATUS_BLOCKED"
        | "ORG_INACTIVE"
        | "USER_INACTIVE"
        | "SLUG_COLLISION";
    };

export type ChangeJobStatusResult =
  | { ok: true; item: { id: string; status: JobStatus } }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_TRANSITION"
        | "ORG_INACTIVE"
        | "USER_INACTIVE";
    };

export type RemoveJobResult =
  | { ok: true; item: { id: string; status: JobStatus } }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "STATUS_BLOCKED"
        | "ORG_INACTIVE"
        | "USER_INACTIVE";
    };

async function resolveEntityNames(
  ids: string[],
  table: "organizations" | "categories" | "professions" | "locations",
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const uniqueIds = Array.from(new Set(ids));
  const sourceTable =
    table === "organizations"
      ? organizations
      : table === "categories"
        ? categories
        : table === "professions"
          ? professions
          : locations;
  const rows = await db
    .select({ id: sql<string>`id`, name: sql<string>`name` })
    .from(sourceTable)
    .where(inArray(sql<string>`id`, uniqueIds));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Lists all jobs across the user's organization memberships.
 */
export async function listEmployerJobs(
  userId: string,
  filters: {
    status?: JobStatus;
    page?: number;
    limit?: number;
  } = {},
): Promise<EmployerJobList> {
  const orgIds = await getUserOrganizationIds(userId);
  if (orgIds.length === 0) {
    return {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    };
  }

  const page = Math.max(
    1,
    Number.isFinite(filters.page) ? Math.trunc(filters.page ?? 1) : 1,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.isFinite(filters.limit) ? Math.trunc(filters.limit ?? 20) : 20,
    ),
  );
  const offset = (page - 1) * limit;

  const conditions = [inArray(jobs.organizationId, orgIds)];

  if (filters.status) {
    conditions.push(eq(jobs.status, filters.status));
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        organizationId: jobs.organizationId,
        status: jobs.status,
        deadline: jobs.deadline,
        createdAt: jobs.createdAt,
        updatedAt: jobs.updatedAt,
      })
      .from(jobs)
      .where(where)
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(where),
  ]);

  const jobIds = rows.map((r) => r.id);

  const countRows =
    jobIds.length > 0
      ? await db
          .select({
            jobId: applications.jobId,
            count: sql<number>`count(*)::int`,
          })
          .from(applications)
          .where(inArray(applications.jobId, jobIds))
          .groupBy(applications.jobId)
      : [];

  const totalCounts = new Map<string, number>();
  for (const row of countRows) {
    totalCounts.set(row.jobId, row.count);
  }

  const needsReviewRows =
    jobIds.length > 0
      ? await db
          .select({
            jobId: applications.jobId,
            count: sql<number>`count(*)::int`,
          })
          .from(applications)
          .where(
            and(
              inArray(applications.jobId, jobIds),
              eq(applications.status, "SUBMITTED"),
            ),
          )
          .groupBy(applications.jobId)
      : [];

  const needsReviewCounts = new Map<string, number>();
  for (const row of needsReviewRows) {
    needsReviewCounts.set(row.jobId, row.count);
  }

  const orgNames = await resolveEntityNames(
    rows.map((r) => r.organizationId),
    "organizations",
  );

  const total = totalRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      organizationId: row.organizationId,
      organizationName: orgNames.get(row.organizationId) ?? "",
      status: row.status as JobStatus,
      deadline: row.deadline,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      applicationCount: totalCounts.get(row.id) ?? 0,
      needsReviewCount: needsReviewCounts.get(row.id) ?? 0,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Gets a single job detail for employer view.
 */
export async function getEmployerJob(
  userId: string,
  jobId: string,
): Promise<EmployerJobDetail | null> {
  const orgIds = await getUserOrganizationIds(userId);
  if (orgIds.length === 0) return null;

  const row = await db
    .select()
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
    .where(and(eq(jobs.id, jobId), inArray(jobs.organizationId, orgIds)))
    .limit(1);

  if (row.length === 0) return null;

  const r = row[0].jobs;
  const org = row[0].organizations;

  const [catNames, profNames, locNames] = await Promise.all([
    r.categoryId
      ? resolveEntityNames([r.categoryId], "categories")
      : Promise.resolve(new Map<string, string>()),
    r.professionId
      ? resolveEntityNames([r.professionId], "professions")
      : Promise.resolve(new Map<string, string>()),
    r.locationId
      ? resolveEntityNames([r.locationId], "locations")
      : Promise.resolve(new Map<string, string>()),
  ]);

  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    organizationId: r.organizationId,
    organizationName: org.name,
    description: r.description,
    responsibilities: r.responsibilities,
    requirements: r.requirements,
    educationRequirements: r.educationRequirements,
    benefits: r.benefits,
    categoryId: r.categoryId,
    categoryName: r.categoryId ? (catNames.get(r.categoryId) ?? null) : null,
    professionId: r.professionId,
    professionName: r.professionId
      ? (profNames.get(r.professionId) ?? null)
      : null,
    locationId: r.locationId,
    locationName: r.locationId ? (locNames.get(r.locationId) ?? null) : null,
    experienceMin: r.experienceMin,
    experienceMax: r.experienceMax,
    employmentType: r.employmentType,
    salaryMin: r.salaryMin,
    salaryMax: r.salaryMax,
    salaryCurrency: r.salaryCurrency,
    salaryPeriod: r.salaryPeriod,
    deadline: r.deadline,
    applicationUrl: r.applicationUrl,
    postedAt: r.postedAt,
    status: r.status as JobStatus,
    verificationStatus: r.verificationStatus,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Creates a new job for an employer. The server sets slug, status, and verificationStatus.
 */
export async function createEmployerJob(
  userId: string,
  input: {
    organizationId: string;
    title: string;
    description: string;
    categoryId?: string | null;
    professionId?: string | null;
    locationId?: string | null;
    responsibilities?: string | null;
    requirements?: string | null;
    educationRequirements?: string | null;
    benefits?: string | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
    employmentType?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    salaryPeriod?: string | null;
    postedAt?: string | null;
    deadline?: string | null;
    applicationUrl?: string | null;
  },
): Promise<CreateEmployerJobResult> {
  return db.transaction(async (tx) => {
    const userRow = await tx
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (
      userRow.length === 0 ||
      userRow[0].role !== "ORGANIZATION_ADMIN" ||
      !userRow[0].isActive
    ) {
      return { ok: false, code: "USER_INACTIVE" as const };
    }

    const orgRow = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1);

    if (orgRow.length === 0) {
      return { ok: false, code: "FORBIDDEN" as const };
    }
    if (orgRow[0].status !== "ACTIVE") {
      return { ok: false, code: "ORG_INACTIVE" as const };
    }

    const membership = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      return { ok: false, code: "FORBIDDEN" as const };
    }

    const baseSlug = generateSlug(input.title);
    let createdJob: (typeof jobs.$inferSelect) | null = null;

    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      const candidateSlug =
        attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        const [created] = await tx
          .insert(jobs)
          .values({
            title: input.title,
            slug: candidateSlug,
            organizationId: input.organizationId,
            categoryId: input.categoryId ?? null,
            professionId: input.professionId ?? null,
            locationId: input.locationId ?? null,
            description: input.description,
            responsibilities: input.responsibilities ?? null,
            requirements: input.requirements ?? null,
            educationRequirements: input.educationRequirements ?? null,
            benefits: input.benefits ?? null,
            experienceMin: input.experienceMin ?? null,
            experienceMax: input.experienceMax ?? null,
            employmentType: (input.employmentType as never) ?? null,
            salaryMin: input.salaryMin != null ? String(input.salaryMin) : null,
            salaryMax: input.salaryMax != null ? String(input.salaryMax) : null,
            salaryCurrency: input.salaryCurrency ?? null,
            salaryPeriod: (input.salaryPeriod as never) ?? null,
            postedAt: input.postedAt ? new Date(input.postedAt) : null,
            deadline: input.deadline ? new Date(input.deadline) : null,
            applicationUrl: input.applicationUrl ?? null,
            status: "DRAFT",
            verificationStatus: "PENDING",
          })
          .returning();

        if (created) {
          createdJob = created;
          break;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("jobs_slug_unique")) {
          continue;
        }
        throw e;
      }
    }

    if (!createdJob) {
      return { ok: false, code: "SLUG_COLLISION" as const };
    }

    await tx.insert(auditLog).values({
      actorUserId: userId,
      action: "JOB_CREATED",
      targetType: "job",
      targetId: createdJob.id,
      metadata: { source: "employer", organizationId: input.organizationId },
    });

    const orgName = await tx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1);

    return {
      ok: true,
      item: {
        id: createdJob.id,
        title: createdJob.title,
        slug: createdJob.slug,
        organizationId: createdJob.organizationId,
        organizationName: orgName[0]?.name ?? "",
        description: createdJob.description,
        responsibilities: createdJob.responsibilities,
        requirements: createdJob.requirements,
        educationRequirements: createdJob.educationRequirements,
        benefits: createdJob.benefits,
        categoryId: createdJob.categoryId,
        categoryName: null,
        professionId: createdJob.professionId,
        professionName: null,
        locationId: createdJob.locationId,
        locationName: null,
        experienceMin: createdJob.experienceMin,
        experienceMax: createdJob.experienceMax,
        employmentType: createdJob.employmentType,
        salaryMin: createdJob.salaryMin,
        salaryMax: createdJob.salaryMax,
        salaryCurrency: createdJob.salaryCurrency,
        salaryPeriod: createdJob.salaryPeriod,
        deadline: createdJob.deadline,
        applicationUrl: createdJob.applicationUrl,
        postedAt: createdJob.postedAt,
        status: createdJob.status as JobStatus,
        verificationStatus: createdJob.verificationStatus,
        createdAt: createdJob.createdAt,
        updatedAt: createdJob.updatedAt,
      },
    };
  });
}

/**
 * Updates an employer's job. Only allowed for DRAFT/PENDING_REVIEW status.
 */
export async function updateEmployerJob(
  userId: string,
  jobId: string,
  input: {
    title?: string;
    description?: string;
    categoryId?: string | null;
    professionId?: string | null;
    locationId?: string | null;
    responsibilities?: string | null;
    requirements?: string | null;
    educationRequirements?: string | null;
    benefits?: string | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
    employmentType?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    salaryPeriod?: string | null;
    postedAt?: string | null;
    deadline?: string | null;
    applicationUrl?: string | null;
  },
): Promise<UpdateEmployerJobResult> {
  return db.transaction(async (tx) => {
    const jobRow = await tx
      .select({
        id: jobs.id,
        status: jobs.status,
        organizationId: jobs.organizationId,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (jobRow.length === 0) {
      return { ok: false, code: "NOT_FOUND" as const };
    }

    const r = jobRow[0];

    const userRow = await tx
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (
      userRow.length === 0 ||
      userRow[0].role !== "ORGANIZATION_ADMIN" ||
      !userRow[0].isActive
    ) {
      return { ok: false, code: "USER_INACTIVE" as const };
    }

    const orgRow = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, r.organizationId))
      .limit(1);

    if (orgRow.length === 0 || orgRow[0].status !== "ACTIVE") {
      return {
        ok: false,
        code: orgRow.length === 0 ? ("FORBIDDEN" as const) : ("ORG_INACTIVE" as const),
      };
    }

    const membership = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, r.organizationId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      return { ok: false, code: "FORBIDDEN" as const };
    }

    const currentStatus = r.status as JobStatus;
    if (
      !EDITABLE_STATUSES.includes(
        currentStatus as (typeof EDITABLE_STATUSES)[number],
      )
    ) {
      return { ok: false, code: "STATUS_BLOCKED" as const };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.professionId !== undefined)
      updateData.professionId = input.professionId;
    if (input.locationId !== undefined) updateData.locationId = input.locationId;
    if (input.responsibilities !== undefined)
      updateData.responsibilities = input.responsibilities;
    if (input.requirements !== undefined)
      updateData.requirements = input.requirements;
    if (input.educationRequirements !== undefined)
      updateData.educationRequirements = input.educationRequirements;
    if (input.benefits !== undefined) updateData.benefits = input.benefits;
    if (input.experienceMin !== undefined)
      updateData.experienceMin = input.experienceMin;
    if (input.experienceMax !== undefined)
      updateData.experienceMax = input.experienceMax;
    if (input.employmentType !== undefined)
      updateData.employmentType = input.employmentType;
    if (input.salaryMin !== undefined)
      updateData.salaryMin =
        input.salaryMin != null ? String(input.salaryMin) : null;
    if (input.salaryMax !== undefined)
      updateData.salaryMax =
        input.salaryMax != null ? String(input.salaryMax) : null;
    if (input.salaryCurrency !== undefined)
      updateData.salaryCurrency = input.salaryCurrency;
    if (input.salaryPeriod !== undefined)
      updateData.salaryPeriod = input.salaryPeriod;
    if (input.postedAt !== undefined)
      updateData.postedAt = input.postedAt ? new Date(input.postedAt) : null;
    if (input.deadline !== undefined)
      updateData.deadline = input.deadline ? new Date(input.deadline) : null;
    if (input.applicationUrl !== undefined)
      updateData.applicationUrl = input.applicationUrl;

    const fields = Object.keys(updateData).filter((k) => k !== "updatedAt");

    if (fields.length === 0) {
      return {
        ok: true,
        item: { id: jobId, updatedAt: new Date() },
      };
    }

    const [updated] = await tx
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId))
      .returning({ id: jobs.id, updatedAt: jobs.updatedAt });

    await tx.insert(auditLog).values({
      actorUserId: userId,
      action: "JOB_UPDATED",
      targetType: "job",
      targetId: jobId,
      metadata: { source: "employer", fields },
    });

    return {
      ok: true,
      item: { id: updated.id, updatedAt: updated.updatedAt },
    };
  });
}

/**
 * Changes job status by employer. Only DRAFT↔PENDING_REVIEW transitions allowed.
 */
export async function changeEmployerJobStatus(
  userId: string,
  jobId: string,
  newStatus: JobStatus,
): Promise<ChangeJobStatusResult> {
  return db.transaction(async (tx) => {
    const jobRow = await tx
      .select({
        id: jobs.id,
        currentStatus: jobs.status,
        organizationId: jobs.organizationId,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (jobRow.length === 0) {
      return { ok: false, code: "NOT_FOUND" as const };
    }

    const r = jobRow[0];

    const userRow = await tx
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (
      userRow.length === 0 ||
      userRow[0].role !== "ORGANIZATION_ADMIN" ||
      !userRow[0].isActive
    ) {
      return { ok: false, code: "USER_INACTIVE" as const };
    }

    const orgRow = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, r.organizationId))
      .limit(1);

    if (orgRow.length === 0 || orgRow[0].status !== "ACTIVE") {
      return {
        ok: false,
        code: orgRow.length === 0 ? ("FORBIDDEN" as const) : ("ORG_INACTIVE" as const),
      };
    }

    const membership = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, r.organizationId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      return { ok: false, code: "FORBIDDEN" as const };
    }

    const currentStatus = r.currentStatus as JobStatus;
    const allowed = VALID_EMPLOYER_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return { ok: false, code: "INVALID_TRANSITION" as const };
    }

    const [updated] = await tx
      .update(jobs)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning({ id: jobs.id, status: jobs.status });

    await tx.insert(auditLog).values({
      actorUserId: userId,
      action: "JOB_UPDATED",
      targetType: "job",
      targetId: jobId,
      metadata: {
        source: "employer",
        fromStatus: currentStatus,
        toStatus: newStatus,
      },
    });

    return {
      ok: true,
      item: { id: updated.id, status: updated.status as JobStatus },
    };
  });
}

/**
 * Removes a job by setting status to REMOVED. Only DRAFT/PENDING_REVIEW jobs can be removed.
 */
export async function removeEmployerJob(
  userId: string,
  jobId: string,
): Promise<RemoveJobResult> {
  return db.transaction(async (tx) => {
    const jobRow = await tx
      .select({
        id: jobs.id,
        currentStatus: jobs.status,
        organizationId: jobs.organizationId,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (jobRow.length === 0) {
      return { ok: false, code: "NOT_FOUND" as const };
    }

    const r = jobRow[0];

    const userRow = await tx
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (
      userRow.length === 0 ||
      userRow[0].role !== "ORGANIZATION_ADMIN" ||
      !userRow[0].isActive
    ) {
      return { ok: false, code: "USER_INACTIVE" as const };
    }

    const orgRow = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, r.organizationId))
      .limit(1);

    if (orgRow.length === 0 || orgRow[0].status !== "ACTIVE") {
      return {
        ok: false,
        code: orgRow.length === 0 ? ("FORBIDDEN" as const) : ("ORG_INACTIVE" as const),
      };
    }

    const membership = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, r.organizationId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      return { ok: false, code: "FORBIDDEN" as const };
    }

    const currentStatus = r.currentStatus as JobStatus;
    if (
      !REMOVABLE_STATUSES.includes(
        currentStatus as (typeof REMOVABLE_STATUSES)[number],
      )
    ) {
      return { ok: false, code: "STATUS_BLOCKED" as const };
    }

    const [updated] = await tx
      .update(jobs)
      .set({ status: "REMOVED" as never, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning({ id: jobs.id, status: jobs.status });

    await tx.insert(auditLog).values({
      actorUserId: userId,
      action: "JOB_DELETED",
      targetType: "job",
      targetId: jobId,
      metadata: { source: "employer", fromStatus: currentStatus },
    });

    return {
      ok: true,
      item: { id: updated.id, status: updated.status as JobStatus },
    };
  });
}
