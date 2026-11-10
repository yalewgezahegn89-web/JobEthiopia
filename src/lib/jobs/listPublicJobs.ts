import { and, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { escapeLikePattern } from "@/lib/apiUtils";
import { buildPublicJobEligibilityConditions } from "@/lib/jobs/eligibility";
import type { JobListQuery } from "@/lib/validations/jobQuery";
import { isPgTrgmAvailable } from "@/lib/search/trgm";
import {
  buildJobListOrder,
  buildKeywordMatchCondition,
  buildSalaryConditions,
  type JobListSort,
  type SearchTier,
} from "@/lib/search/jobSearch";
import {
  toPublicJobSummary,
  type PublicJobList,
  type PublicJobPagination,
} from "@/lib/jobs/public";

export type PublicJobListResult = {
  items: Array<Record<string, unknown>>;
  pagination: PublicJobPagination;
};

function toEntityMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function listPublicJobs(
  query: JobListQuery,
): Promise<PublicJobListResult> {
  const {
    page,
    limit,
    employmentType,
    organizationId,
    categoryId,
    professionId,
    locationId,
    q,
    sort,
    salaryMin,
    salaryMax,
  } = query;
  const offset = (page - 1) * limit;
  const keyword = q?.trim();

  let organizationNameIds: string[] = [];
  if (keyword) {
    const escapedKeyword = escapeLikePattern(keyword);
    const matches = await db.query.organizations.findMany({
      columns: { id: true },
      where: ilike(organizations.name, `%${escapedKeyword}%`),
    });
    organizationNameIds = matches.map((match) => match.id);
  }

  const tier: SearchTier = keyword
    ? (await isPgTrgmAvailable())
      ? "trgm"
      : "substring"
    : "substring";

  const now = new Date();
  const conditions: (SQL | undefined)[] =
    await buildPublicJobEligibilityConditions(now);
  if (employmentType) {
    conditions.push(eq(jobs.employmentType, employmentType as never));
  }
  if (organizationId) {
    conditions.push(eq(jobs.organizationId, organizationId));
  }
  if (categoryId) {
    conditions.push(eq(jobs.categoryId, categoryId));
  }
  if (professionId) {
    conditions.push(eq(jobs.professionId, professionId));
  }
  if (locationId) {
    conditions.push(eq(jobs.locationId, locationId));
  }
  if (keyword) {
    conditions.push(
      buildKeywordMatchCondition({
        q: keyword,
        organizationNameIds,
        tier,
      }),
    );
  }
  conditions.push(...buildSalaryConditions(salaryMin, salaryMax));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const requestedSort = (sort as JobListSort | undefined) ?? null;
  const effectiveSort: JobListSort =
    !keyword && requestedSort === "relevance"
      ? "newest"
      : (requestedSort ?? (keyword ? "relevance" : "newest"));

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(jobs).where(where),
    db.query.jobs.findMany({
      where,
      orderBy: buildJobListOrder(effectiveSort, {
        q: keyword ?? "",
        organizationIds: organizationNameIds,
        trgm: tier === "trgm",
      }),
      limit,
      offset,
      columns: {
        description: false,
        responsibilities: false,
        requirements: false,
        educationRequirements: false,
        benefits: false,
      },
    }),
  ]);

  const organizationIds = [
    ...new Set(
      rows
        .map((row) => row.organizationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const categoryIds = [
    ...new Set(
      rows
        .map((row) => row.categoryId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const professionIds = [
    ...new Set(
      rows
        .map((row) => row.professionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const locationIds = [
    ...new Set(
      rows
        .map((row) => row.locationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const entityColumns = { id: true, name: true, slug: true } as const;

  const [organizationRows, categoryRows, professionRows, locationRows] =
    await Promise.all([
      organizationIds.length > 0
        ? db.query.organizations.findMany({
            columns: entityColumns,
            where: inArray(organizations.id, organizationIds),
          })
        : Promise.resolve([] as { id: string }[]),
      categoryIds.length > 0
        ? db.query.categories.findMany({
            columns: entityColumns,
            where: inArray(categories.id, categoryIds),
          })
        : Promise.resolve([] as { id: string }[]),
      professionIds.length > 0
        ? db.query.professions.findMany({
            columns: entityColumns,
            where: inArray(professions.id, professionIds),
          })
        : Promise.resolve([] as { id: string }[]),
      locationIds.length > 0
        ? db.query.locations.findMany({
            columns: entityColumns,
            where: inArray(locations.id, locationIds),
          })
        : Promise.resolve([] as { id: string }[]),
    ]);

  const organizationMap = toEntityMap(organizationRows);
  const categoryMap = toEntityMap(categoryRows);
  const professionMap = toEntityMap(professionRows);
  const locationMap = toEntityMap(locationRows);

  const items = rows.map((row) => ({
    ...row,
    organization: row.organizationId
      ? organizationMap.get(row.organizationId) ?? null
      : null,
    category: row.categoryId ? categoryMap.get(row.categoryId) ?? null : null,
    profession: row.professionId
      ? professionMap.get(row.professionId) ?? null
      : null,
    location: row.locationId ? locationMap.get(row.locationId) ?? null : null,
  }));

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export async function listPublicJobSummaries(
  query: JobListQuery,
): Promise<PublicJobList> {
  const result = await listPublicJobs(query);
  return {
    items: result.items.map((item) => toPublicJobSummary(item)),
    pagination: result.pagination,
  };
}

export type { PublicJobList };
