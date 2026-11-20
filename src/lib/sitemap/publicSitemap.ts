import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";
import { careerArticles } from "@/db/schema/careerArticles";
import { DEFAULT_STALE_MAX_AGE_DAYS } from "@/lib/jobs/public";
import { LOCALES } from "@/lib/i18n/locale";
import { localizePath } from "@/lib/i18n/routing";
import { LEGAL_PAGE_KEYS, legalPagePath } from "@/lib/legal/paths";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";
import { X_DEFAULT_LOCALE } from "@/lib/seo/constants";

export const SITEMAP_PAGE_LIMIT = 500;
/**
 * Safety ceiling for a single generated sitemap. Beyond this, a sitemap index
 * is required; the current single-file architecture stays well below that.
 */
export const SITEMAP_MAX_ENTITIES = 10_000;

/** Public pages whose interface and metadata are genuinely localized. */
export const PUBLIC_STATIC_PATHS = [
  "/",
  "/jobs",
  "/organizations",
  "/categories",
  "/professions",
  "/locations",
  "/careers",
  "/contact",
] as const;

export type SitemapUrlInput = {
  path: string;
  lastModified?: string;
  /** Relative paths per locale; resolved to absolute URLs by the sitemap route. */
  alternates?: { languages: Record<string, string> };
};

export type SitemapData = {
  staticPaths: string[];
  jobs: { id: string }[];
  organizations: { id: string }[];
  categories: { id: string }[];
  professions: { id: string }[];
  locations: { id: string }[];
  careerArticles: { id: string }[];
};

type DbClient = typeof db;

async function collectPagedIds<T extends { id: string }>(
  fetchPage: (offset: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];

  while (rows.length < SITEMAP_MAX_ENTITIES) {
    const page = await fetchPage(rows.length);
    if (page.length === 0) break;
    rows.push(...page.slice(0, SITEMAP_MAX_ENTITIES - rows.length));
    if (page.length < SITEMAP_PAGE_LIMIT) break;
  }

  return rows;
}

export async function collectSitemapData(
  queryDb: DbClient,
  now: Date,
): Promise<SitemapData> {
  const activeOrganizationRows = await collectPagedIds((offset) =>
    queryDb.query.organizations.findMany({
      columns: { id: true },
      where: eq(organizations.status, "ACTIVE"),
      limit: SITEMAP_PAGE_LIMIT,
      offset,
    }),
  );
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

  const [jobRows, organizationRows, categoryRows, professionRows, locationRows, articleRows] =
    await Promise.all([
      collectPagedIds((offset) =>
        queryDb.query.jobs.findMany({
          columns: { id: true },
          where: jobWhere,
          orderBy: [desc(jobs.createdAt)],
          limit: SITEMAP_PAGE_LIMIT,
          offset,
        }),
      ),
      collectPagedIds((offset) =>
        queryDb.query.organizations.findMany({
          columns: { id: true },
          where: eq(organizations.status, "ACTIVE"),
          limit: SITEMAP_PAGE_LIMIT,
          offset,
        }),
      ),
      collectPagedIds((offset) =>
        queryDb.query.categories.findMany({
          columns: { id: true },
          where: eq(categories.isActive, true),
          limit: SITEMAP_PAGE_LIMIT,
          offset,
        }),
      ),
      collectPagedIds((offset) =>
        queryDb.query.professions.findMany({
          columns: { id: true },
          where: eq(professions.isActive, true),
          limit: SITEMAP_PAGE_LIMIT,
          offset,
        }),
      ),
      collectPagedIds((offset) =>
        queryDb.query.locations.findMany({
          columns: { id: true },
          where: eq(locations.isActive, true),
          limit: SITEMAP_PAGE_LIMIT,
          offset,
        }),
      ),
      collectPagedIds((offset) =>
        queryDb.query.careerArticles.findMany({
          columns: { id: true },
          where: and(
            eq(careerArticles.status, "PUBLISHED"),
            sql`${careerArticles.publishedAt} IS NOT NULL AND ${careerArticles.publishedAt} <= ${now.toISOString()}`,
          ),
          orderBy: [desc(careerArticles.publishedAt)],
          limit: SITEMAP_PAGE_LIMIT,
          offset,
        }),
      ),
    ]);

  return {
    staticPaths: [...PUBLIC_STATIC_PATHS],
    jobs: jobRows.map((row) => ({ id: row.id })),
    organizations: organizationRows.map((row) => ({ id: row.id })),
    categories: categoryRows.map((row) => ({ id: row.id })),
    professions: professionRows.map((row) => ({ id: row.id })),
    locations: locationRows.map((row) => ({ id: row.id })),
    careerArticles: articleRows.map((row) => ({ id: row.id })),
  };
}

function localizedAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(
      LOCALES.map((locale) => [locale, localizePath(path, locale)]),
    ),
    [X_DEFAULT_LOCALE]: localizePath(path, "en"),
  };
}

/**
 * Localized public pages get one sitemap entry per real locale URL plus a
 * complete hreflang cluster. Entity detail pages are deliberately excluded:
 * their body content is not translated.
 */
export function localizedSitemapEntries(
  paths: readonly string[],
): SitemapUrlInput[] {
  return paths.flatMap((path) => {
    const languages = localizedAlternates(path);
    return LOCALES.map((locale) => ({
      path: localizePath(path, locale),
      alternates: { languages },
    }));
  });
}

/** Legal documents are fully translated, so each locale gets its own URL. */
export function legalSitemapEntries(): SitemapUrlInput[] {
  return LEGAL_PAGE_KEYS.flatMap((key) =>
    localizedSitemapEntries([legalPagePath(key)]).map((entry) => ({
      ...entry,
      lastModified: LEGAL_OPERATOR.effectiveDate,
    })),
  );
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
  const careerArticleUrls = data.careerArticles.map((article) => ({
    path: `/careers/${article.id}`,
  }));

  return [
    ...localizedSitemapEntries(data.staticPaths),
    ...legalSitemapEntries(),
    ...jobUrls,
    ...organizationUrls,
    ...categoryUrls,
    ...professionUrls,
    ...locationUrls,
    ...careerArticleUrls,
  ];
}

export async function buildPublicSitemapUrls(now?: Date): Promise<SitemapUrlInput[]> {
  const reference = now ?? new Date();
  const data = await collectSitemapData(db, reference);
  return buildSitemapUrls(data);
}
