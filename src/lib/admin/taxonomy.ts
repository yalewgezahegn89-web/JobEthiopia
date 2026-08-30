/**
 * Admin taxonomy management helpers (Batch 71).
 *
 * Server-side data access for categories, professions, and locations.
 * All functions assume the caller has already performed session
 * authentication and role authorization. Identity is never taken from
 * client input.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { jobs } from "@/db/schema/jobs";
import { auditLog } from "@/db/schema/auditLog";
import {
  createCategorySchema,
  updateCategorySchema,
  createProfessionSchema,
  updateProfessionSchema,
  createLocationSchema,
  updateLocationSchema,
} from "@/lib/validations";

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

export type CategoryAdminSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  sortOrder: number;
  childCount: number;
  jobCount: number;
  professionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryAdminPaginated = {
  items: CategoryAdminSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CategoryAdminDetail = CategoryAdminSummary & {
  children: { id: string; name: string; slug: string }[];
};

export async function listCategories(input: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}): Promise<CategoryAdminPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.isActive !== undefined) {
    filters.push(eq(categories.isActive, input.isActive));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.categories.findMany({
      where,
      orderBy: [desc(categories.sortOrder), desc(categories.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  const categoryIds = rows.map((r) => r.id);
  const parentIds = rows.map((r) => r.parentId).filter((id): id is string => Boolean(id));

  const [parentNames, childCounts, jobCounts, professionCounts] = await Promise.all([
    parentIds.length > 0
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(sql`${categories.id} IN (${sql.join(parentIds.map((id) => sql`${id}`), sql`, `)})`)
      : [],
    categoryIds.length > 0
      ? db
          .select({ parentId: categories.parentId, count: sql<number>`count(*)::int` })
          .from(categories)
          .where(sql`${categories.parentId} IN (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(categories.parentId)
      : [],
    categoryIds.length > 0
      ? db
          .select({ categoryId: jobs.categoryId, count: sql<number>`count(*)::int` })
          .from(jobs)
          .where(sql`${jobs.categoryId} IN (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(jobs.categoryId)
      : [],
    categoryIds.length > 0
      ? db
          .select({ categoryId: professions.categoryId, count: sql<number>`count(*)::int` })
          .from(professions)
          .where(sql`${professions.categoryId} IN (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(professions.categoryId)
      : [],
  ]);

  const parentNameMap = new Map(parentNames.map((p) => [p.id, p.name]));
  const childCountMap = new Map(childCounts.map((c) => [c.parentId, c.count]));
  const jobCountMap = new Map(jobCounts.map((j) => [j.categoryId, j.count]));
  const professionCountMap = new Map(professionCounts.map((p) => [p.categoryId, p.count]));

  const items = rows
    .filter((r) => !input.search || r.name.toLowerCase().includes(input.search.toLowerCase()))
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      parentId: r.parentId,
      parentName: r.parentId ? (parentNameMap.get(r.parentId) ?? null) : null,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      childCount: childCountMap.get(r.id) ?? 0,
      jobCount: jobCountMap.get(r.id) ?? 0,
      professionCount: professionCountMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getCategory(id: string): Promise<CategoryAdminDetail | null> {
  if (!isValidUuid(id)) return null;

  const cat = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!cat) return null;

  const [parentRow, children, jobCountRow, professionCountRow] = await Promise.all([
    cat.parentId
      ? db.query.categories.findFirst({
          where: eq(categories.id, cat.parentId),
          columns: { id: true, name: true, slug: true },
        })
      : null,
    db.query.categories.findMany({
      where: eq(categories.parentId, cat.id),
      columns: { id: true, name: true, slug: true },
      orderBy: [desc(categories.sortOrder)],
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.categoryId, cat.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(professions)
      .where(eq(professions.categoryId, cat.id)),
  ]);

  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    parentId: cat.parentId,
    parentName: parentRow?.name ?? null,
    isActive: cat.isActive,
    sortOrder: cat.sortOrder,
    childCount: children.length,
    jobCount: jobCountRow[0]?.count ?? 0,
    professionCount: professionCountRow[0]?.count ?? 0,
    children: children.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  };
}

/**
 * Detects a cycle: starting from `parentId`, walks up the parent chain.
 * Returns true if `candidateId` is encountered (i.e. would create a cycle).
 */
async function hasCategoryCycle(candidateId: string, parentId: string): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (currentId === candidateId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const parent: { parentId: string | null } | undefined = await db.query.categories.findFirst({
      where: eq(categories.id, currentId),
      columns: { parentId: true },
    });
    currentId = parent?.parentId ?? null;
  }

  return false;
}

export type CategoryCreateResult =
  | { ok: true; id: string }
  | { ok: false; code: "VALIDATION" | "DUPLICATE" | "CYCLE" | "SELF_PARENT" };

export async function createCategory(
  input: {
    name: string;
    slug: string;
    description?: string | null;
    parentId?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  },
  actorUserId: string,
): Promise<CategoryCreateResult> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const data = parsed.data;

  if (data.parentId) {
    const parentExists = await db.query.categories.findFirst({
      where: eq(categories.id, data.parentId),
      columns: { id: true },
    });
    if (!parentExists) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  try {
    let categoryId: string = "";
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(categories)
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          parentId: data.parentId ?? null,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        })
        .returning({ id: categories.id });

      categoryId = inserted.id;

      await tx.insert(auditLog).values({
        actorUserId,
        action: "CATEGORY_CREATED",
        targetType: "category",
        targetId: inserted.id,
        metadata: { name: data.name, slug: data.slug },
      });
    });

    return { ok: true, id: categoryId };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("categories_slug_unique")) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

export type CategoryUpdateResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION" | "DUPLICATE" | "CYCLE" | "SELF_PARENT" };

export async function updateCategory(
  id: string,
  input: Record<string, unknown>,
  actorUserId: string,
): Promise<CategoryUpdateResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, id),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  if (data.parentId !== undefined) {
    if (data.parentId === id) {
      return { ok: false, code: "SELF_PARENT" };
    }
    if (data.parentId) {
      const parentExists = await db.query.categories.findFirst({
        where: eq(categories.id, data.parentId),
        columns: { id: true },
      });
      if (!parentExists) {
        return { ok: false, code: "VALIDATION" };
      }
      if (await hasCategoryCycle(id, data.parentId)) {
        return { ok: false, code: "CYCLE" };
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(categories)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "CATEGORY_UPDATED",
        targetType: "category",
        targetId: id,
        metadata: { fields: Object.keys(data) },
      });
    });

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("categories_slug_unique")) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

export type CategoryDeleteResult =
  | { ok: true; affected: { jobs: number; professions: number; children: number } }
  | { ok: false; code: "NOT_FOUND" };

export async function getCategoryDeleteImpact(
  id: string,
): Promise<{ jobs: number; professions: number; children: number } | null> {
  if (!isValidUuid(id)) return null;

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, id),
    columns: { id: true },
  });
  if (!existing) return null;

  const [jobCount, professionCount, childCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.categoryId, id)),
    db.select({ count: sql<number>`count(*)::int` }).from(professions).where(eq(professions.categoryId, id)),
    db.select({ count: sql<number>`count(*)::int` }).from(categories).where(eq(categories.parentId, id)),
  ]);

  return {
    jobs: jobCount[0]?.count ?? 0,
    professions: professionCount[0]?.count ?? 0,
    children: childCount[0]?.count ?? 0,
  };
}

export async function deleteCategory(
  id: string,
  actorUserId: string,
): Promise<CategoryDeleteResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, id),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const impact = await getCategoryDeleteImpact(id);

  await db.transaction(async (tx) => {
    await tx.delete(categories).where(eq(categories.id, id));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "CATEGORY_DELETED",
      targetType: "category",
      targetId: id,
      metadata: { name: existing.name, impact },
    });
  });

  return {
    ok: true,
    affected: impact ?? { jobs: 0, professions: 0, children: 0 },
  };
}

export type CategoryToggleResult =
  | { ok: true; isActive: boolean }
  | { ok: false; code: "NOT_FOUND" };

export async function toggleCategoryActive(
  id: string,
  actorUserId: string,
): Promise<CategoryToggleResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, id),
    columns: { id: true, isActive: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const newIsActive = !existing.isActive;

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ isActive: newIsActive, updatedAt: new Date() })
      .where(eq(categories.id, id));

    await tx.insert(auditLog).values({
      actorUserId,
      action: newIsActive ? "CATEGORY_UPDATED" : "CATEGORY_UPDATED",
      targetType: "category",
      targetId: id,
      metadata: { fields: ["isActive"], fromIsActive: existing.isActive, toIsActive: newIsActive },
    });
  });

  return { ok: true, isActive: newIsActive };
}

/* -------------------------------------------------------------------------- */
/*  Professions                                                               */
/* -------------------------------------------------------------------------- */

export type ProfessionAdminSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  jobCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProfessionAdminPaginated = {
  items: ProfessionAdminSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ProfessionAdminDetail = ProfessionAdminSummary;

export async function listProfessions(input: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  categoryId?: string;
  search?: string;
}): Promise<ProfessionAdminPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.isActive !== undefined) {
    filters.push(eq(professions.isActive, input.isActive));
  }
  if (input.categoryId) {
    filters.push(eq(professions.categoryId, input.categoryId));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.professions.findMany({
      where,
      orderBy: [desc(professions.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(professions)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  const professionIds = rows.map((r) => r.id);
  const catIds = rows.map((r) => r.categoryId).filter((id): id is string => Boolean(id));

  const [catNames, jobCounts] = await Promise.all([
    catIds.length > 0
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(sql`${categories.id} IN (${sql.join(catIds.map((id) => sql`${id}`), sql`, `)})`)
      : [],
    professionIds.length > 0
      ? db
          .select({ professionId: jobs.professionId, count: sql<number>`count(*)::int` })
          .from(jobs)
          .where(sql`${jobs.professionId} IN (${sql.join(professionIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(jobs.professionId)
      : [],
  ]);

  const catNameMap = new Map(catNames.map((c) => [c.id, c.name]));
  const jobCountMap = new Map(jobCounts.map((j) => [j.professionId, j.count]));

  const items = rows
    .filter((r) => !input.search || r.name.toLowerCase().includes(input.search.toLowerCase()))
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      categoryId: r.categoryId,
      categoryName: r.categoryId ? (catNameMap.get(r.categoryId) ?? null) : null,
      isActive: r.isActive,
      jobCount: jobCountMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProfession(id: string): Promise<ProfessionAdminDetail | null> {
  if (!isValidUuid(id)) return null;

  const prof = await db.query.professions.findFirst({ where: eq(professions.id, id) });
  if (!prof) return null;

  const [catName, jobCountRow] = await Promise.all([
    prof.categoryId
      ? db.query.categories.findFirst({
          where: eq(categories.id, prof.categoryId),
          columns: { name: true },
        })
      : null,
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.professionId, prof.id)),
  ]);

  return {
    id: prof.id,
    name: prof.name,
    slug: prof.slug,
    description: prof.description,
    categoryId: prof.categoryId,
    categoryName: catName?.name ?? null,
    isActive: prof.isActive,
    jobCount: jobCountRow[0]?.count ?? 0,
    createdAt: prof.createdAt.toISOString(),
    updatedAt: prof.updatedAt.toISOString(),
  };
}

export type ProfessionCreateResult =
  | { ok: true; id: string }
  | { ok: false; code: "VALIDATION" | "DUPLICATE" };

export async function createProfession(
  input: {
    name: string;
    slug: string;
    description?: string | null;
    categoryId?: string | null;
    isActive?: boolean;
  },
  actorUserId: string,
): Promise<ProfessionCreateResult> {
  const parsed = createProfessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const data = parsed.data;

  if (data.categoryId) {
    const catExists = await db.query.categories.findFirst({
      where: eq(categories.id, data.categoryId),
      columns: { id: true },
    });
    if (!catExists) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  try {
    let professionId: string = "";
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(professions)
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          categoryId: data.categoryId ?? null,
          isActive: data.isActive ?? true,
        })
        .returning({ id: professions.id });

      professionId = inserted.id;

      await tx.insert(auditLog).values({
        actorUserId,
        action: "PROFESSION_CREATED",
        targetType: "profession",
        targetId: inserted.id,
        metadata: { name: data.name, slug: data.slug },
      });
    });

    return { ok: true, id: professionId };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("professions_slug_unique")) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

export type ProfessionUpdateResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION" | "DUPLICATE" };

export async function updateProfession(
  id: string,
  input: Record<string, unknown>,
  actorUserId: string,
): Promise<ProfessionUpdateResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const parsed = updateProfessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const existing = await db.query.professions.findFirst({
    where: eq(professions.id, id),
    columns: { id: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  if (data.categoryId) {
    const catExists = await db.query.categories.findFirst({
      where: eq(categories.id, data.categoryId),
      columns: { id: true },
    });
    if (!catExists) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(professions)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          updatedAt: new Date(),
        })
        .where(eq(professions.id, id));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "PROFESSION_UPDATED",
        targetType: "profession",
        targetId: id,
        metadata: { fields: Object.keys(data) },
      });
    });

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("professions_slug_unique")) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

export type ProfessionDeleteResult =
  | { ok: true; affected: { jobs: number } }
  | { ok: false; code: "NOT_FOUND" };

export async function getProfessionDeleteImpact(
  id: string,
): Promise<{ jobs: number } | null> {
  if (!isValidUuid(id)) return null;

  const existing = await db.query.professions.findFirst({
    where: eq(professions.id, id),
    columns: { id: true },
  });
  if (!existing) return null;

  const [jobCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.professionId, id)),
  ]);

  return {
    jobs: jobCount[0]?.count ?? 0,
  };
}

export async function deleteProfession(
  id: string,
  actorUserId: string,
): Promise<ProfessionDeleteResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.professions.findFirst({
    where: eq(professions.id, id),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const impact = await getProfessionDeleteImpact(id);

  await db.transaction(async (tx) => {
    await tx.delete(professions).where(eq(professions.id, id));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "PROFESSION_DELETED",
      targetType: "profession",
      targetId: id,
      metadata: { name: existing.name, impact },
    });
  });

  return {
    ok: true,
    affected: impact ?? { jobs: 0 },
  };
}

export type ProfessionToggleResult =
  | { ok: true; isActive: boolean }
  | { ok: false; code: "NOT_FOUND" };

export async function toggleProfessionActive(
  id: string,
  actorUserId: string,
): Promise<ProfessionToggleResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.professions.findFirst({
    where: eq(professions.id, id),
    columns: { id: true, isActive: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const newIsActive = !existing.isActive;

  await db.transaction(async (tx) => {
    await tx
      .update(professions)
      .set({ isActive: newIsActive, updatedAt: new Date() })
      .where(eq(professions.id, id));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "PROFESSION_UPDATED",
      targetType: "profession",
      targetId: id,
      metadata: { fields: ["isActive"], fromIsActive: existing.isActive, toIsActive: newIsActive },
    });
  });

  return { ok: true, isActive: newIsActive };
}

/* -------------------------------------------------------------------------- */
/*  Locations                                                                 */
/* -------------------------------------------------------------------------- */

export type LocationAdminSummary = {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
  childCount: number;
  jobCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LocationAdminPaginated = {
  items: LocationAdminSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type LocationAdminDetail = LocationAdminSummary & {
  children: { id: string; name: string; slug: string; type: string }[];
};

export async function listLocations(input: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  type?: string;
  search?: string;
}): Promise<LocationAdminPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.isActive !== undefined) {
    filters.push(eq(locations.isActive, input.isActive));
  }
  if (input.type) {
    filters.push(eq(locations.type, input.type as never));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.locations.findMany({
      where,
      orderBy: [desc(locations.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  const locationIds = rows.map((r) => r.id);
  const parentIds = rows.map((r) => r.parentId).filter((id): id is string => Boolean(id));

  const [parentNames, childCounts, jobCounts] = await Promise.all([
    parentIds.length > 0
      ? db
          .select({ id: locations.id, name: locations.name })
          .from(locations)
          .where(sql`${locations.id} IN (${sql.join(parentIds.map((id) => sql`${id}`), sql`, `)})`)
      : [],
    locationIds.length > 0
      ? db
          .select({ parentId: locations.parentId, count: sql<number>`count(*)::int` })
          .from(locations)
          .where(sql`${locations.parentId} IN (${sql.join(locationIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(locations.parentId)
      : [],
    locationIds.length > 0
      ? db
          .select({ locationId: jobs.locationId, count: sql<number>`count(*)::int` })
          .from(jobs)
          .where(sql`${jobs.locationId} IN (${sql.join(locationIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(jobs.locationId)
      : [],
  ]);

  const parentNameMap = new Map(parentNames.map((p) => [p.id, p.name]));
  const childCountMap = new Map(childCounts.map((c) => [c.parentId, c.count]));
  const jobCountMap = new Map(jobCounts.map((j) => [j.locationId, j.count]));

  const items = rows
    .filter((r) => !input.search || r.name.toLowerCase().includes(input.search.toLowerCase()))
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      type: r.type,
      parentId: r.parentId,
      parentName: r.parentId ? (parentNameMap.get(r.parentId) ?? null) : null,
      latitude: r.latitude,
      longitude: r.longitude,
      isActive: r.isActive,
      childCount: childCountMap.get(r.id) ?? 0,
      jobCount: jobCountMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getLocation(id: string): Promise<LocationAdminDetail | null> {
  if (!isValidUuid(id)) return null;

  const loc = await db.query.locations.findFirst({ where: eq(locations.id, id) });
  if (!loc) return null;

  const [parentRow, children, jobCountRow] = await Promise.all([
    loc.parentId
      ? db.query.locations.findFirst({
          where: eq(locations.id, loc.parentId),
          columns: { id: true, name: true, slug: true, type: true },
        })
      : null,
    db.query.locations.findMany({
      where: eq(locations.parentId, loc.id),
      columns: { id: true, name: true, slug: true, type: true },
      orderBy: [desc(locations.createdAt)],
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.locationId, loc.id)),
  ]);

  return {
    id: loc.id,
    name: loc.name,
    slug: loc.slug,
    type: loc.type,
    parentId: loc.parentId,
    parentName: parentRow?.name ?? null,
    latitude: loc.latitude,
    longitude: loc.longitude,
    isActive: loc.isActive,
    childCount: children.length,
    jobCount: jobCountRow[0]?.count ?? 0,
    children: children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, type: c.type })),
    createdAt: loc.createdAt.toISOString(),
    updatedAt: loc.updatedAt.toISOString(),
  };
}

async function hasLocationCycle(candidateId: string, parentId: string): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (currentId === candidateId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const parent: { parentId: string | null } | undefined = await db.query.locations.findFirst({
      where: eq(locations.id, currentId),
      columns: { parentId: true },
    });
    currentId = parent?.parentId ?? null;
  }

  return false;
}

export type LocationCreateResult =
  | { ok: true; id: string }
  | { ok: false; code: "VALIDATION" | "DUPLICATE" | "CYCLE" | "SELF_PARENT" };

export async function createLocation(
  input: {
    name: string;
    slug: string;
    type: string;
    parentId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isActive?: boolean;
  },
  actorUserId: string,
): Promise<LocationCreateResult> {
  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const data = parsed.data;

  if (data.parentId) {
    const parentExists = await db.query.locations.findFirst({
      where: eq(locations.id, data.parentId),
      columns: { id: true },
    });
    if (!parentExists) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  try {
    let locationId: string = "";
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(locations)
        .values({
          name: data.name,
          slug: data.slug,
          type: data.type as never,
          parentId: data.parentId ?? null,
          latitude: data.latitude != null ? String(data.latitude) : null,
          longitude: data.longitude != null ? String(data.longitude) : null,
          isActive: data.isActive ?? true,
        })
        .returning({ id: locations.id });

      locationId = inserted.id;

      await tx.insert(auditLog).values({
        actorUserId,
        action: "LOCATION_CREATED",
        targetType: "location",
        targetId: inserted.id,
        metadata: { name: data.name, slug: data.slug, type: data.type },
      });
    });

    return { ok: true, id: locationId };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("locations_slug_unique")) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

export type LocationUpdateResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION" | "DUPLICATE" | "CYCLE" | "SELF_PARENT" };

export async function updateLocation(
  id: string,
  input: Record<string, unknown>,
  actorUserId: string,
): Promise<LocationUpdateResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const existing = await db.query.locations.findFirst({
    where: eq(locations.id, id),
    columns: { id: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  if (data.parentId !== undefined) {
    if (data.parentId === id) {
      return { ok: false, code: "SELF_PARENT" };
    }
    if (data.parentId) {
      const parentExists = await db.query.locations.findFirst({
        where: eq(locations.id, data.parentId),
        columns: { id: true },
      });
      if (!parentExists) {
        return { ok: false, code: "VALIDATION" };
      }
      if (await hasLocationCycle(id, data.parentId)) {
        return { ok: false, code: "CYCLE" };
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(locations)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.type !== undefined && { type: data.type as never }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          ...(data.latitude !== undefined && { latitude: data.latitude != null ? String(data.latitude) : null }),
          ...(data.longitude !== undefined && { longitude: data.longitude != null ? String(data.longitude) : null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          updatedAt: new Date(),
        })
        .where(eq(locations.id, id));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "LOCATION_UPDATED",
        targetType: "location",
        targetId: id,
        metadata: { fields: Object.keys(data) },
      });
    });

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("locations_slug_unique")) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

export type LocationDeleteResult =
  | { ok: true; affected: { jobs: number; children: number } }
  | { ok: false; code: "NOT_FOUND" };

export async function getLocationDeleteImpact(
  id: string,
): Promise<{ jobs: number; children: number } | null> {
  if (!isValidUuid(id)) return null;

  const existing = await db.query.locations.findFirst({
    where: eq(locations.id, id),
    columns: { id: true },
  });
  if (!existing) return null;

  const [jobCount, childCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.locationId, id)),
    db.select({ count: sql<number>`count(*)::int` }).from(locations).where(eq(locations.parentId, id)),
  ]);

  return {
    jobs: jobCount[0]?.count ?? 0,
    children: childCount[0]?.count ?? 0,
  };
}

export async function deleteLocation(
  id: string,
  actorUserId: string,
): Promise<LocationDeleteResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.locations.findFirst({
    where: eq(locations.id, id),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const impact = await getLocationDeleteImpact(id);

  await db.transaction(async (tx) => {
    await tx.delete(locations).where(eq(locations.id, id));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "LOCATION_DELETED",
      targetType: "location",
      targetId: id,
      metadata: { name: existing.name, impact },
    });
  });

  return {
    ok: true,
    affected: impact ?? { jobs: 0, children: 0 },
  };
}

export type LocationToggleResult =
  | { ok: true; isActive: boolean }
  | { ok: false; code: "NOT_FOUND" };

export async function toggleLocationActive(
  id: string,
  actorUserId: string,
): Promise<LocationToggleResult> {
  if (!isValidUuid(id)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.locations.findFirst({
    where: eq(locations.id, id),
    columns: { id: true, isActive: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const newIsActive = !existing.isActive;

  await db.transaction(async (tx) => {
    await tx
      .update(locations)
      .set({ isActive: newIsActive, updatedAt: new Date() })
      .where(eq(locations.id, id));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "LOCATION_UPDATED",
      targetType: "location",
      targetId: id,
      metadata: { fields: ["isActive"], fromIsActive: existing.isActive, toIsActive: newIsActive },
    });
  });

  return { ok: true, isActive: newIsActive };
}
