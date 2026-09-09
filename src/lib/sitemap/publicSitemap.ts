import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { DEFAULT_STALE_MAX_AGE_DAYS } from "@/lib/jobs/public";

export const SITEMAP_PAGE_LIMIT = 500;

export type SitemapUrlInput = {
  path: string;
  lastModified?: string;
};

export type SitemapData = {
  staticPaths: string[];
  jobs: { id: string }[];
  organizations: { id: string }[];
  categories: { id: string }[];
  professions: { id: string }[];
  locations: { id: string }[];
};

type DbClient = typeof db;

export async function collectSitemapData(
  queryDb: DbClient,
  now: Date,
): Promise<SitemapData> {
  const activeOrganizationRows = await queryDb.query.organizations.findMany({
    columns: { id: true },
    where: eq(organizations.status, "ACTIVE"),
  });
  const activeOrgIds = activeOrganizationRows.map((row) => row.id);

  const staleCutoff = new Date(
    now.getTime() - DEFAULT_STALE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );

  const jobConditions: (SQL | undefined)[] = [
    eq(jobs.status, "PUBLISHED"),
    sql`${jobs.lastVerifiedAt} IS NOT NULL AND ${jobs.lastVerifiedAt} > ${staleCutoff.toISOString()}`,
    sql`(${jobs.deadline} IS NULL OR ${jobs.deadline} >= ${now.toISOString()})`,
  ];
  if (activeOrgIds.length > 0) {
    jobConditions.push(inArray(jobs.organizationId, activeOrgIds));
  } else {
    jobConditions.push(sql`1 = 0`);
  }

  const jobWhere = and(...jobConditions);

  const [jobRows, organizationRows, categoryRows, professionRows, locationRows] =
    await Promise.all([
      queryDb.query.jobs.findMany({
        columns: { id: true },
        where: jobWhere,
        orderBy: [desc(jobs.createdAt)],
        limit: SITEMAP_PAGE_LIMIT,
        offset: 0,
      }),
      queryDb.query.organizations.findMany({
        columns: { id: true },
        where: eq(organizations.status, "ACTIVE"),
      }),
      queryDb.query.categories.findMany({
        columns: { id: true },
        where: eq(categories.isActive, true),
      }),
      queryDb.query.professions.findMany({
        columns: { id: true },
        where: eq(professions.isActive, true),
      }),
      queryDb.query.locations.findMany({
        columns: { id: true },
        where: eq(locations.isActive, true),
      }),
    ]);

  return {
    staticPaths: ["/", "/jobs", "/careers"],
    jobs: jobRows.map((row) => ({ id: row.id })),
    organizations: organizationRows.map((row) => ({ id: row.id })),
    categories: categoryRows.map((row) => ({ id: row.id })),
    professions: professionRows.map((row) => ({ id: row.id })),
    locations: locationRows.map((row) => ({ id: row.id })),
  };
}

export function buildSitemapUrls(data: SitemapData): SitemapUrlInput[] {
  const jobUrls = data.jobs.map((job) => ({ path: `/jobs/${job.id}` }));
  const organizationUrls = data.organizations.map((org) => ({
    path: `/organizations/${org.id}`,
  }));
  const categoryUrls = data.categories.map((category) => ({
    path: `/categories/${category.id}`,
  }));
  const professionUrls = data.professions.map((profession) => ({
    path: `/professions/${profession.id}`,
  }));
  const locationUrls = data.locations.map((location) => ({
    path: `/locations/${location.id}`,
  }));

  return [
    ...data.staticPaths.map((path) => ({ path })),
    ...jobUrls,
    ...organizationUrls,
    ...categoryUrls,
    ...professionUrls,
    ...locationUrls,
  ];
}

export async function buildPublicSitemapUrls(now?: Date): Promise<SitemapUrlInput[]> {
  const reference = now ?? new Date();
  const data = await collectSitemapData(db, reference);
  return buildSitemapUrls(data);
}
