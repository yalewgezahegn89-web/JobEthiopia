/**
 * Analytics summary queries (admin reporting).
 *
 * Combines first-party discovery events (analytics_events) with metrics that
 * are derived from existing tables so that product analytics remain a thin,
 * query-only layer over the schema of record:
 *
 * - engagement: applications, saved_jobs, job_alert_deliveries, users
 * - moderation: audit_log moderation actions
 * - platforms ops: jobs, sessions, sources, audit_log ingestion runs
 *
 * All time bucketing is computed in UTC for consistency across hosts.
 */
import {
  and,
  desc,
  eq,
  gte,
  gt,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { applications } from "@/db/schema/applications";
import { savedJobs } from "@/db/schema/savedJobs";
import { jobAlertDeliveries } from "@/db/schema/jobAlertDeliveries";
import { users } from "@/db/schema/users";
import { auditLog } from "@/db/schema/auditLog";
import { jobs } from "@/db/schema/jobs";
import { sessions } from "@/db/schema/sessions";
import { sources } from "@/db/schema/sources";
import { organizations } from "@/db/schema/organizations";
import { notifications } from "@/db/schema/notifications";
import { DISCOVERY_EVENTS, type DiscoveryEventName } from "./events";
import { CV_EVENTS } from "./cvEvents";
import { COVER_LETTER_EVENTS } from "./coverLetterEvents";
import { MATCH_EVENTS } from "./matchingEvents";
import {
  ANALYTICS_WINDOWS,
  DEFAULT_ANALYTICS_WINDOW_ID,
  getAnalyticsWindow,
  windowStart,
  type AnalyticsTrendUnit,
  type AnalyticsWindow,
  type AnalyticsWindowId,
} from "./timeWindows";

export type DailyCount = { day: string; count: number };
export type LocaleBreakdown = { locale: string; count: number };
export type TopViewedJob = { jobId: string; title: string | null; views: number };
export type TopAppliedJob = {
  jobId: string;
  title: string | null;
  applications: number;
};

export type LatestIngestionSummary = {
  timestamp: string;
  sourceId: string | null;
  total: number | null;
  created: number;
  updated: number;
  failed: number;
  durationMs: number | null;
};

export type SearchQuality = {
  searches: number;
  zeroResultSearches: number;
  zeroResultRate: number;
  avgResults: number;
  filters: { query: number; category: number; profession: number; location: number; employmentType: number; organization: number };
};

export type PathCount = { path: string; count: number };

export type PublicPages = {
  total: number;
  topPaths: PathCount[];
};

export type ApplicationFunnel = {
  total: number;
  byStatus: { status: string; count: number }[];
};

export type EventCount = { event: string; count: number };

export type CareerTools = {
  cvActions: number;
  coverLetterActions: number;
  toolPageViews: number;
  byEvent: EventCount[];
};

export type RecommendationMetrics = {
  views: number;
  feedbackTotal: number;
  avgResults: number;
  feedback: { relevant: number; notRelevant: number; hidden: number };
};

export type NotificationMetrics = {
  created: number;
  read: number;
  unread: number;
  readRate: number;
  byType: { type: string; count: number }[];
};

export type EmployerMetrics = {
  totalOrganizations: number;
  newOrganizations: number;
  employerAccounts: number;
  jobsCreated: number;
  applicationsReceived: number;
  applicationReviews: number;
};

export type IngestionMetrics = {
  runs: number;
  jobsIngested: number;
  activeSources: number;
};

export type AdvertisingMetrics = {
  impressions: number;
  clicks: number;
  ctr: number;
  byPlacement: { placementId: string; impressions: number; clicks: number }[];
};

export type AnalyticsTrends = {
  pageViews: DailyCount[];
  recommendationViews: DailyCount[];
  feedback: DailyCount[];
  adImpressions: DailyCount[];
  adClicks: DailyCount[];
};

export type AnalyticsSummary = {
  window: {
    id: AnalyticsWindowId;
    totalDays: number;
    dailyDays: number;
    trendUnit: AnalyticsTrendUnit;
    dateTo: string;
  };
  discovery: {
    totals: Record<DiscoveryEventName, number>;
    daily: Record<DiscoveryEventName, DailyCount[]>;
    byLocale: LocaleBreakdown[];
    topViewedJobs: TopViewedJob[];
    topAppliedJobs: TopAppliedJob[];
  };
  searchQuality: SearchQuality;
  publicPages: PublicPages;
  engagement: {
    applications: { total: number; daily: DailyCount[] };
    savedJobs: { total: number; daily: DailyCount[] };
    alertDeliveries: { total: number; daily: DailyCount[] };
    registrations: { total: number; daily: DailyCount[] };
  };
  funnel: ApplicationFunnel;
  recommendations: RecommendationMetrics;
  careerTools: CareerTools;
  notifications: NotificationMetrics;
  employer: EmployerMetrics;
  ingestion: IngestionMetrics;
  trends: AnalyticsTrends;
  moderation: {
    jobPublished: number;
    jobRejected: number;
    jobReverified: number;
  };
  monetization: AdvertisingMetrics;
  platform: {
    publishedJobs: number;
    pendingReviewJobs: number;
    activeSessions: number;
    totalSources: number;
    failingSources: number;
    latestIngestion: LatestIngestionSummary | null;
  };
};

export const DEFAULT_WINDOW_ID: AnalyticsWindowId = DEFAULT_ANALYTICS_WINDOW_ID;

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

function hoursAgo(hours: number, now: Date): Date {
  return new Date(now.getTime() - hours * 3_600_000);
}


async function bucketCounts(
  table: AnyPgTable,
  on: AnyPgColumn,
  where?: SQL,
): Promise<DailyCount[]> {
  const day = sql<string>`to_char(${on} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, count: sql<number>`count(*)::int` })
    .from(table)
    .where(where)
    .groupBy(day)
    .orderBy(day);
  return rows.map((row) => ({ day: row.day, count: Number(row.count) }));
}

async function countWhere(table: AnyPgTable, where?: SQL): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return toCount(rows[0]?.count);
}

/**
 * Windowed single-row count with a caller-supplied column alias so every
 * metric query has a self-describing, independently mockable shape.
 */
async function countMetric(
  table: AnyPgTable,
  alias: string,
  where?: SQL,
): Promise<number> {
  const rows = await db
    .select({ [alias]: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  const row = (rows[0] ?? {}) as Record<string, unknown>;
  return toCount(row[alias]);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns a zero-filled daily series for the last `days` complete-or-current UTC days. */
function fillDailySeries(days: number, rows: DailyCount[]): DailyCount[] {
  const byDay = new Map(rows.map((row) => [row.day, row.count]));
  const start = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const series: DailyCount[] = [];
  for (let i = 0; i < days; i += 1) {
    const cursor = new Date(start);
    cursor.setUTCDate(start.getUTCDate() + i);
    series.push({ day: dayKey(cursor), count: byDay.get(dayKey(cursor)) ?? 0 });
  }
  return series;
}

function parseLatestIngestion(row: {
  metadata: unknown;
  targetId: string | null;
  createdAt: Date;
}): LatestIngestionSummary {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    timestamp: row.createdAt.toISOString(),
    sourceId: row.targetId,
    total: typeof meta.total === "number" ? meta.total : null,
    created: Number(meta.created ?? 0),
    updated: Number(meta.updated ?? 0),
    failed: Number(meta.failed ?? 0),
    durationMs: typeof meta.durationMs === "number" ? meta.durationMs : null,
  };
}

/**
 * Monetization counts (ad impressions/clicks) over a bounded window, sourced
 * from the same analytics_events allowlist used by capture.
 */
export async function getMonetizationCounts(
  now: Date = new Date(),
  days: number = ANALYTICS_WINDOWS[DEFAULT_WINDOW_ID].days,
): Promise<{ impressions: number; clicks: number }> {
  const totalFrom = daysAgo(days, now);
  const [impressions, clicks] = await Promise.all([
    countWhere(
      analyticsEvents,
      and(
        eq(analyticsEvents.event, "ad_impression"),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    ),
    countWhere(
      analyticsEvents,
      and(
        eq(analyticsEvents.event, "ad_click"),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    ),
  ]);
  return { impressions, clicks };
}

function trendBucketExpr(
  on: AnyPgColumn,
  unit: AnalyticsTrendUnit,
): SQL<string> {
  return unit === "hour"
    ? sql<string>`to_char(${on} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24')`
    : sql<string>`to_char(${on} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
}

async function bucketHourCounts(
  table: AnyPgTable,
  on: AnyPgColumn,
  where?: SQL,
): Promise<DailyCount[]> {
  const hour = trendBucketExpr(on, "hour");
  const rows = await db
    .select({ hour, count: sql<number>`count(*)::int` })
    .from(table)
    .where(where)
    .groupBy(hour)
    .orderBy(hour);
  return rows.map((row) => ({ day: row.hour, count: toCount(row.count) }));
}

function hourKey(date: Date): string {
  return date.toISOString().slice(0, 13);
}

/** Returns a zero-filled hourly series for the last `points` wall-clock hours. */
function fillHourlySeries(points: number, rows: DailyCount[]): DailyCount[] {
  const byHour = new Map(rows.map((row) => [row.day, row.count]));
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
    ),
  );
  start.setTime(start.getTime() - (points - 1) * 3_600_000);

  const series: DailyCount[] = [];
  for (let i = 0; i < points; i += 1) {
    const cursor = new Date(start.getTime() + i * 3_600_000);
    const key = hourKey(cursor);
    series.push({ day: key, count: byHour.get(key) ?? 0 });
  }
  return series;
}

/** Defensive numeric coercion: any driver shape (string|bigint|null) → number. */
function toCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

const FUNNEL_STATUSES = [
  "SUBMITTED",
  "REVIEWING",
  "SHORTLISTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

/** Event totals captured for career tools + public page views. */
const CAREER_TOOL_EVENTS = [...CV_EVENTS, ...COVER_LETTER_EVENTS];
const PAGE_AND_TOOL_EVENTS = ["page_viewed", ...CAREER_TOOL_EVENTS];
const RECOMMENDATION_EVENTS: string[] = [...MATCH_EVENTS];
const AD_EVENT_NAMES = ["ad_impression", "ad_click"];
/** Single grouped pass that feeds five trend series at once. */
const TREND_EVENTS = [
  "page_viewed",
  ...RECOMMENDATION_EVENTS,
  ...AD_EVENT_NAMES,
];
/** Paths counted as career-tool page views. */
const TOOL_PATHS = ["/cv", "/cover-letter", "/interview-prep"];

export type AnalyticsSummaryOptions = {
  /** Accepts raw request input (`?window=…`); unknown values fall back to 30d. */
  windowId?: unknown;
  /** Opt-in 60s in-process cache. Off by default so tests stay exact. */
  cache?: boolean;
};

const SUMMARY_CACHE_TTL_MS = 60_000;
const SUMMARY_CACHE_MAX_ENTRIES = 4;
const summaryCache = new Map<
  string,
  { expiresAt: number; summary: AnalyticsSummary }
>();

/** Drops all cached summaries (used by tests and after data-affecting admin writes). */
export function clearAnalyticsSummaryCache(): void {
  summaryCache.clear();
}

type TrendContext = {
  totalFrom: Date;
  trendFrom: Date;
  trendUnit: AnalyticsTrendUnit;
  fillTrend: (rows: DailyCount[]) => DailyCount[];
};

/**
 * Windowed metrics appended after every legacy query so that the long-stable
 * aggregate contract (`AnalyticsSummary` core sections) is untouched.
 *
 * All queries are bounded by the selected window, grouped/limited, and use
 * only the select().from().where().groupBy().orderBy().limit() chain.
 */
async function collectExtendedAnalytics(
  trend: TrendContext,
): Promise<{
  searchQuality: SearchQuality;
  publicPages: PublicPages;
  funnel: ApplicationFunnel;
  topAppliedJobs: TopAppliedJob[];
  careerTools: CareerTools;
  recommendations: RecommendationMetrics;
  notifications: NotificationMetrics;
  employer: EmployerMetrics;
  ingestion: IngestionMetrics;
  monetizationByPlacement: AdvertisingMetrics["byPlacement"];
  trends: AnalyticsTrends;
}> {
  const { totalFrom, trendFrom, fillTrend } = trend;
  const meta = analyticsEvents.metadata;

  // Search quality: one FILTER pass answers "what do people search, do they
  // find anything, and which filters do they use?".
  const searchRows = await db
    .select({
      searches: sql<number>`count(*)::int`,
      zeroResults: sql<number>`(count(*) FILTER (WHERE coalesce((${meta}->>'resultCount')::int, 0) = 0))::int`,
      totalResults: sql<number>`(coalesce(sum((${meta}->>'resultCount')::int), 0))::int`,
      withQuery: sql<number>`(count(*) FILTER (WHERE ${meta}->>'hasQuery' = 'true'))::int`,
      withCategory: sql<number>`(count(*) FILTER (WHERE ${meta}->>'hasCategory' = 'true'))::int`,
      withProfession: sql<number>`(count(*) FILTER (WHERE ${meta}->>'hasProfession' = 'true'))::int`,
      withLocation: sql<number>`(count(*) FILTER (WHERE ${meta}->>'hasLocation' = 'true'))::int`,
      withEmploymentType: sql<number>`(count(*) FILTER (WHERE ${meta}->>'hasEmploymentType' = 'true'))::int`,
      withOrganization: sql<number>`(count(*) FILTER (WHERE ${meta}->>'hasOrganization' = 'true'))::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.event, "job_search"),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    );
  const search = searchRows[0];
  const searches = toCount(search?.searches);
  const zeroResultSearches = toCount(search?.zeroResults);
  const searchQuality: SearchQuality = {
    searches,
    zeroResultSearches,
    zeroResultRate: percentOf(zeroResultSearches, searches),
    avgResults:
      searches > 0 ? Math.round((toCount(search?.totalResults) / searches) * 10) / 10 : 0,
    filters: {
      query: toCount(search?.withQuery),
      category: toCount(search?.withCategory),
      profession: toCount(search?.withProfession),
      location: toCount(search?.withLocation),
      employmentType: toCount(search?.withEmploymentType),
      organization: toCount(search?.withOrganization),
    },
  };

  // Page views + career tool lifecycle events in one grouped pass.
  const eventTotalRows = await db
    .select({
      event: analyticsEvents.event,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.event, PAGE_AND_TOOL_EVENTS),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    )
    .groupBy(analyticsEvents.event);
  const eventTotals = new Map<string, number>(
    eventTotalRows.map((row) => [row.event, toCount(row.count)]),
  );

  const pathRows = await db
    .select({
      path: sql<string>`${meta}->>'path'`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.event, "page_viewed"),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    )
    .groupBy(sql`${meta}->>'path'`)
    .orderBy(sql`count(*)::int DESC`)
    .limit(10);
  const topPaths: PathCount[] = pathRows.map((row) => ({
    path: String(row.path ?? ""),
    count: toCount(row.count),
  }));
  const publicPages: PublicPages = {
    total: eventTotals.get("page_viewed") ?? 0,
    topPaths,
  };

  const cvActions = CAREER_TOOL_EVENTS.filter((event) => event.startsWith("cv_"))
    .reduce((sum, event) => sum + (eventTotals.get(event) ?? 0), 0);
  const coverLetterActions = CAREER_TOOL_EVENTS.filter((event) =>
    event.startsWith("cover_letter_"),
  ).reduce((sum, event) => sum + (eventTotals.get(event) ?? 0), 0);
  const careerTools: CareerTools = {
    cvActions,
    coverLetterActions,
    toolPageViews: topPaths
      .filter((row) => TOOL_PATHS.includes(row.path as (typeof TOOL_PATHS)[number]))
      .reduce((sum, row) => sum + row.count, 0),
    byEvent: CAREER_TOOL_EVENTS.map((event) => ({
      event,
      count: eventTotals.get(event) ?? 0,
    })).filter((row) => row.count > 0),
  };

  // Recommendations: views, how many results each view produced, feedback mix.
  const recommendationRows = await db
    .select({
      views: sql<number>`(count(*) FILTER (WHERE ${analyticsEvents.event} = 'match_recommendations_viewed'))::int`,
      feedbackTotal: sql<number>`(count(*) FILTER (WHERE ${analyticsEvents.event} = 'match_feedback_submitted'))::int`,
      resultsTotal: sql<number>`(coalesce(sum((${meta}->>'resultCount')::int), 0))::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.event, RECOMMENDATION_EVENTS),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    );
  const recommendation = recommendationRows[0];
  const recViews = toCount(recommendation?.views);
  const feedbackTotal = toCount(recommendation?.feedbackTotal);

  const feedbackRows = await db
    .select({
      feedbackType: sql<string>`${meta}->>'feedbackType'`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.event, "match_feedback_submitted"),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    )
    .groupBy(sql`${meta}->>'feedbackType'`)
    .orderBy(sql`count(*)::int DESC`)
    .limit(10);
  const feedbackByType = new Map<string, number>(
    feedbackRows
      .filter((row) => row.feedbackType)
      .map((row) => [String(row.feedbackType), toCount(row.count)]),
  );
  const recommendations: RecommendationMetrics = {
    views: recViews,
    feedbackTotal,
    avgResults:
      recViews > 0
        ? Math.round((toCount(recommendation?.resultsTotal) / recViews) * 10) / 10
        : 0,
    feedback: {
      relevant: feedbackByType.get("relevant") ?? 0,
      notRelevant: feedbackByType.get("not_relevant") ?? 0,
      hidden: feedbackByType.get("hidden") ?? 0,
    },
  };

  // Application funnel: current status of applications created in the window.
  const statusRows = await db
    .select({
      status: applications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(applications)
    .where(gte(applications.createdAt, totalFrom))
    .groupBy(applications.status)
    .orderBy(sql`count(*)::int DESC`);
  const statusCounts = new Map<string, number>(
    statusRows.map((row) => [row.status, toCount(row.count)]),
  );
  const extraStatuses = statusRows
    .map((row) => row.status)
    .filter((status) => !(FUNNEL_STATUSES as readonly string[]).includes(status));
  const byStatus = [
    ...FUNNEL_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
    ...extraStatuses.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
  ];
  const funnelTotal = byStatus.reduce((sum, row) => sum + row.count, 0);
  const funnel: ApplicationFunnel = { total: funnelTotal, byStatus };

  // Which jobs actually receive applications (the question views cannot answer).
  const appliedRows = await db
    .select({
      jobId: applications.jobId,
      applied: sql<number>`count(*)::int`,
    })
    .from(applications)
    .where(gte(applications.createdAt, totalFrom))
    .groupBy(applications.jobId)
    .orderBy(sql`count(*)::int DESC`)
    .limit(10);
  const appliedIds = appliedRows
    .map((row) => row.jobId)
    .filter((id): id is string => Boolean(id));
  let appliedTitles = new Map<string, string>();
  if (appliedIds.length > 0) {
    const appliedTitleRows = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(inArray(jobs.id, appliedIds));
    appliedTitles = new Map(appliedTitleRows.map((row) => [row.id, row.title]));
  }
  const topAppliedJobs: TopAppliedJob[] = appliedRows.map((row) => ({
    jobId: String(row.jobId),
    title: appliedTitles.get(String(row.jobId)) ?? null,
    applications: toCount(row.applied),
  }));

  // Notifications: created in window, unread gauge (point in time), top types.
  const notificationRows = await db
    .select({
      created: sql<number>`(count(*) FILTER (WHERE ${gte(notifications.createdAt, totalFrom)}))::int`,
      read: sql<number>`(count(*) FILTER (WHERE ${gte(notifications.createdAt, totalFrom)} AND ${notifications.readAt} IS NOT NULL))::int`,
      unread: sql<number>`(count(*) FILTER (WHERE ${notifications.readAt} IS NULL))::int`,
    })
    .from(notifications);
  const notificationRow = notificationRows[0];
  const notificationsCreated = toCount(notificationRow?.created);
  const notificationsRead = toCount(notificationRow?.read);

  const notificationTypeRows = await db
    .select({
      type: notifications.type,
      count: sql<number>`count(*)::int`,
    })
    .from(notifications)
    .where(gte(notifications.createdAt, totalFrom))
    .groupBy(notifications.type)
    .orderBy(sql`count(*)::int DESC`)
    .limit(8);
  const notificationMetrics: NotificationMetrics = {
    created: notificationsCreated,
    read: notificationsRead,
    unread: toCount(notificationRow?.unread),
    readRate: percentOf(notificationsRead, notificationsCreated),
    byType: notificationTypeRows.map((row) => ({
      type: row.type,
      count: toCount(row.count),
    })),
  };

  const [
    totalOrganizations,
    newOrganizations,
    employerAccounts,
    jobsCreated,
    applicationReviews,
  ] = await Promise.all([
    countMetric(organizations, "totalOrganizations"),
    countMetric(organizations, "newOrganizations", gte(organizations.createdAt, totalFrom)),
    countMetric(users, "employerAccounts", eq(users.role, "ORGANIZATION_ADMIN")),
    countMetric(jobs, "jobsCreated", gte(jobs.createdAt, totalFrom)),
    countMetric(
      auditLog,
      "applicationReviews",
      and(
        eq(auditLog.action, "APPLICATION_STATUS_CHANGED"),
        gte(auditLog.createdAt, totalFrom),
      ),
    ),
  ]);
  const employer: EmployerMetrics = {
    totalOrganizations,
    newOrganizations,
    employerAccounts,
    jobsCreated,
    applicationsReceived: funnelTotal,
    applicationReviews,
  };

  const ingestionRows = await db
    .select({
      runs: sql<number>`(count(*) FILTER (WHERE ${auditLog.action} = 'INGESTION_RUN'))::int`,
      jobsIngested: sql<number>`(count(*) FILTER (WHERE ${auditLog.action} = 'JOB_INGESTED'))::int`,
    })
    .from(auditLog)
    .where(gte(auditLog.createdAt, totalFrom));
  const activeSources = await countMetric(
    sources,
    "activeSources",
    eq(sources.isActive, true),
  );
  const ingestion: IngestionMetrics = {
    runs: toCount(ingestionRows[0]?.runs),
    jobsIngested: toCount(ingestionRows[0]?.jobsIngested),
    activeSources,
  };

  const placementRows = await db
    .select({
      placementId: sql<string>`coalesce(${meta}->>'placementId', 'unknown')`,
      event: analyticsEvents.event,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.event, AD_EVENT_NAMES),
        gte(analyticsEvents.createdAt, totalFrom),
      ),
    )
    .groupBy(sql`coalesce(${meta}->>'placementId', 'unknown')`, analyticsEvents.event)
    .orderBy(sql`count(*)::int DESC`)
    .limit(20);
  const placementMap = new Map<
    string,
    { impressions: number; clicks: number }
  >();
  for (const row of placementRows) {
    const id = String(row.placementId ?? "unknown");
    const bucket = placementMap.get(id) ?? { impressions: 0, clicks: 0 };
    if (row.event === "ad_impression") bucket.impressions += toCount(row.count);
    if (row.event === "ad_click") bucket.clicks += toCount(row.count);
    placementMap.set(id, bucket);
  }
  const monetizationByPlacement = [...placementMap.entries()]
    .map(([placementId, counts]) => ({ placementId, ...counts }))
    .sort((a, b) => b.impressions - a.impressions);

  // One grouped pass feeds five series (page views, recommendations, feedback,
  // ad impressions, ad clicks) instead of one query per series.
  const trendBucket = trendBucketExpr(analyticsEvents.createdAt, trend.trendUnit);
  const trendRows = await db
    .select({
      event: analyticsEvents.event,
      bucket: trendBucket,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.event, TREND_EVENTS),
        gte(analyticsEvents.createdAt, trendFrom),
      ),
    )
    .groupBy(analyticsEvents.event, trendBucket)
    .orderBy(trendBucket);
  const seriesFor = (event: string): DailyCount[] =>
    fillTrend(
      trendRows
        .filter((row) => row.event === event)
        .map((row) => ({ day: row.bucket, count: toCount(row.count) })),
    );
  const trends: AnalyticsTrends = {
    pageViews: seriesFor("page_viewed"),
    recommendationViews: seriesFor("match_recommendations_viewed"),
    feedback: seriesFor("match_feedback_submitted"),
    adImpressions: seriesFor("ad_impression"),
    adClicks: seriesFor("ad_click"),
  };

  return {
    searchQuality,
    publicPages,
    funnel,
    topAppliedJobs,
    careerTools,
    recommendations,
    notifications: notificationMetrics,
    employer,
    ingestion,
    monetizationByPlacement,
    trends,
  };
}

async function buildAnalyticsSummary(
  now: Date,
  win: AnalyticsWindow,
): Promise<AnalyticsSummary> {
  const totalFrom = windowStart(win, now);
  const trendUnit = win.trendUnit;
  const trendPoints = trendUnit === "hour" ? 24 : win.trendPoints;
  const trendFrom =
    trendUnit === "hour" ? hoursAgo(24, now) : daysAgo(win.trendPoints, now);

  const bucketTrend = async (
    table: AnyPgTable,
    on: AnyPgColumn,
    where?: SQL,
  ): Promise<DailyCount[]> =>
    trendUnit === "hour"
      ? bucketHourCounts(table, on, where)
      : bucketCounts(table, on, where);
  const fillTrend = (rows: DailyCount[]): DailyCount[] =>
    trendUnit === "hour"
      ? fillHourlySeries(trendPoints, rows)
      : fillDailySeries(trendPoints, rows);

  const discoveryTotals = {} as Record<DiscoveryEventName, number>;
  const discoveryDaily = {} as Record<DiscoveryEventName, DailyCount[]>;
  for (const event of DISCOVERY_EVENTS) {
    discoveryTotals[event] = await countWhere(
      analyticsEvents,
      and(eq(analyticsEvents.event, event), gte(analyticsEvents.createdAt, totalFrom)),
    );
    const rows = await bucketTrend(
      analyticsEvents,
      analyticsEvents.createdAt,
      and(eq(analyticsEvents.event, event), gte(analyticsEvents.createdAt, trendFrom)),
    );
    discoveryDaily[event] = fillTrend(rows);
  }

  const localeRows = await db
    .select({
      locale: analyticsEvents.locale,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, totalFrom))
    .groupBy(analyticsEvents.locale)
    .orderBy(sql`count(*)::int DESC`);
  const byLocale: LocaleBreakdown[] = localeRows.map((row) => ({
    locale: row.locale,
    count: toCount(row.count),
  }));

  const topJobRows = await db
    .select({
      jobId: analyticsEvents.jobId,
      views: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.event, "job_viewed"),
        gte(analyticsEvents.createdAt, totalFrom),
        sql`${analyticsEvents.jobId} IS NOT NULL`,
      ),
    )
    .groupBy(analyticsEvents.jobId)
    .orderBy(sql`count(*)::int DESC`)
    .limit(10);

  const jobIds = topJobRows
    .map((row) => row.jobId)
    .filter((id): id is string => Boolean(id));
  let jobTitles = new Map<string, string>();
  if (jobIds.length > 0) {
    const jobRows = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(inArray(jobs.id, jobIds));
    jobTitles = new Map(jobRows.map((row) => [row.id, row.title]));
  }
  const topViewedJobs: TopViewedJob[] = topJobRows.map((row) => ({
    jobId: String(row.jobId),
    title: jobTitles.get(String(row.jobId)) ?? null,
    views: toCount(row.views),
  }));

  const [applicationsTotal, applicationsDaily, savedTotal, savedDaily] =
    await Promise.all([
      countWhere(applications, gte(applications.createdAt, totalFrom)),
      bucketTrend(
        applications,
        applications.createdAt,
        gte(applications.createdAt, trendFrom),
      ),
      countWhere(savedJobs, gte(savedJobs.createdAt, totalFrom)),
      bucketTrend(savedJobs, savedJobs.createdAt, gte(savedJobs.createdAt, trendFrom)),
    ]);

  const [alertDeliveriesTotal, alertDeliveriesDaily, registrationsTotal, registrationsDaily] =
    await Promise.all([
      countWhere(jobAlertDeliveries, gte(jobAlertDeliveries.sentAt, totalFrom)),
      bucketTrend(
        jobAlertDeliveries,
        jobAlertDeliveries.sentAt,
        gte(jobAlertDeliveries.sentAt, trendFrom),
      ),
      countWhere(
        users,
        and(eq(users.role, "CANDIDATE"), gte(users.createdAt, totalFrom)),
      ),
      bucketTrend(
        users,
        users.createdAt,
        and(eq(users.role, "CANDIDATE"), gte(users.createdAt, trendFrom)),
      ),
    ]);

  const [jobPublished, jobRejected, jobReverified] = await Promise.all([
    countWhere(
      auditLog,
      and(eq(auditLog.action, "JOB_PUBLISHED"), gte(auditLog.createdAt, totalFrom)),
    ),
    countWhere(
      auditLog,
      and(eq(auditLog.action, "JOB_REJECTED"), gte(auditLog.createdAt, totalFrom)),
    ),
    countWhere(
      auditLog,
      and(eq(auditLog.action, "JOB_REVERIFIED"), gte(auditLog.createdAt, totalFrom)),
    ),
  ]);

  const [publishedJobs, pendingReviewJobs, activeSessions, totalSources, failingSources] =
    await Promise.all([
      countWhere(jobs, eq(jobs.status, "PUBLISHED")),
      countWhere(jobs, eq(jobs.status, "PENDING_REVIEW")),
      countWhere(sessions, gt(sessions.expiresAt, now)),
      countWhere(sources),
      countWhere(
        sources,
        or(gt(sources.consecutiveFailures, 0), sql`${sources.lastError} IS NOT NULL`),
      ),
    ]);

  const latestIngestionRow = await db.query.auditLog.findFirst({
    where: eq(auditLog.action, "INGESTION_RUN"),
    orderBy: [desc(auditLog.createdAt), desc(auditLog.id)],
    columns: { metadata: true, targetId: true, createdAt: true },
  });

  const monetization = await getMonetizationCounts(now, win.days);

  const extended = await collectExtendedAnalytics({
    totalFrom,
    trendFrom,
    trendUnit,
    fillTrend,
  });

  return {
    window: {
      id: win.id,
      totalDays: win.days,
      dailyDays: trendPoints,
      trendUnit,
      dateTo: now.toISOString(),
    },
    discovery: {
      totals: discoveryTotals,
      daily: discoveryDaily,
      byLocale,
      topViewedJobs,
      topAppliedJobs: extended.topAppliedJobs,
    },
    searchQuality: extended.searchQuality,
    publicPages: extended.publicPages,
    engagement: {
      applications: { total: applicationsTotal, daily: fillTrend(applicationsDaily) },
      savedJobs: { total: savedTotal, daily: fillTrend(savedDaily) },
      alertDeliveries: {
        total: alertDeliveriesTotal,
        daily: fillTrend(alertDeliveriesDaily),
      },
      registrations: {
        total: registrationsTotal,
        daily: fillTrend(registrationsDaily),
      },
    },
    funnel: extended.funnel,
    recommendations: extended.recommendations,
    careerTools: extended.careerTools,
    notifications: extended.notifications,
    employer: extended.employer,
    ingestion: extended.ingestion,
    trends: extended.trends,
    moderation: {
      jobPublished,
      jobRejected,
      jobReverified,
    },
    monetization: {
      impressions: monetization.impressions,
      clicks: monetization.clicks,
      ctr: percentOf(monetization.clicks, monetization.impressions),
      byPlacement: extended.monetizationByPlacement,
    },
    platform: {
      publishedJobs,
      pendingReviewJobs,
      activeSessions,
      totalSources,
      failingSources,
      latestIngestion: latestIngestionRow
        ? parseLatestIngestion(latestIngestionRow)
        : null,
    },
  };
}

/**
 * Windowed, cached analytics summary.
 *
 * - `windowId` scopes every windowed number to the same explicit window;
 * - `cache: true` serves repeat renders from a 60s in-process cache (the
 *   dashboard opts in; tests do not, so they always see fresh queries);
 * - the default call shape (`getAnalyticsSummary()`) is unchanged.
 */
export async function getAnalyticsSummary(
  now: Date = new Date(),
  options: AnalyticsSummaryOptions = {},
): Promise<AnalyticsSummary> {
  const win = getAnalyticsWindow(options.windowId);
  const cacheKey = `${win.id}|${Math.floor(now.getTime() / SUMMARY_CACHE_TTL_MS)}`;

  if (options.cache) {
    const hit = summaryCache.get(cacheKey);
    if (hit) {
      if (hit.expiresAt > Date.now()) return hit.summary;
      summaryCache.delete(cacheKey);
    }
  }

  const summary = await buildAnalyticsSummary(now, win);

  if (options.cache) {
    summaryCache.set(cacheKey, {
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      summary,
    });
    if (summaryCache.size > SUMMARY_CACHE_MAX_ENTRIES) {
      const oldest = summaryCache.keys().next().value;
      if (oldest !== undefined) summaryCache.delete(oldest);
    }
  }
  return summary;
}
