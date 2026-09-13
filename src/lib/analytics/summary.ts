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
import { DISCOVERY_EVENTS, type DiscoveryEventName } from "./events";

export type DailyCount = { day: string; count: number };
export type LocaleBreakdown = { locale: string; count: number };
export type TopViewedJob = { jobId: string; title: string | null; views: number };

export type LatestIngestionSummary = {
  timestamp: string;
  sourceId: string | null;
  total: number | null;
  created: number;
  updated: number;
  failed: number;
  durationMs: number | null;
};

export type AnalyticsSummary = {
  window: {
    totalDays: number;
    dailyDays: number;
    dateTo: string;
  };
  discovery: {
    totals: Record<DiscoveryEventName, number>;
    daily: Record<DiscoveryEventName, DailyCount[]>;
    byLocale: LocaleBreakdown[];
    topViewedJobs: TopViewedJob[];
  };
  engagement: {
    applications: { total: number; daily: DailyCount[] };
    savedJobs: { total: number; daily: DailyCount[] };
    alertDeliveries: { total: number; daily: DailyCount[] };
    registrations: { total: number; daily: DailyCount[] };
  };
  moderation: {
    jobPublished: number;
    jobRejected: number;
    jobReverified: number;
  };
  monetization: {
    impressions: number;
    clicks: number;
  };
  platform: {
    publishedJobs: number;
    pendingReviewJobs: number;
    activeSessions: number;
    totalSources: number;
    failingSources: number;
    latestIngestion: LatestIngestionSummary | null;
  };
};

const TOTAL_WINDOW_DAYS = 30;
const DAILY_WINDOW_DAYS = 14;

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 86_400_000);
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
  return Number(rows[0]?.count ?? 0);
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
 * Monetization counts (ad impressions/clicks) over the 30-day window, sourced
 * from the same analytics_events allowlist used by capture.
 */
export async function getMonetizationCounts(
  now: Date = new Date(),
): Promise<{ impressions: number; clicks: number }> {
  const totalFrom = daysAgo(TOTAL_WINDOW_DAYS, now);
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

export async function getAnalyticsSummary(
  now: Date = new Date(),
): Promise<AnalyticsSummary> {
  const totalFrom = daysAgo(TOTAL_WINDOW_DAYS, now);
  const dailyFrom = daysAgo(DAILY_WINDOW_DAYS, now);

  const discoveryTotals = {} as Record<DiscoveryEventName, number>;
  const discoveryDaily = {} as Record<DiscoveryEventName, DailyCount[]>;
  for (const event of DISCOVERY_EVENTS) {
    discoveryTotals[event] = await countWhere(
      analyticsEvents,
      and(eq(analyticsEvents.event, event), gte(analyticsEvents.createdAt, totalFrom)),
    );
    const rows = await bucketCounts(
      analyticsEvents,
      analyticsEvents.createdAt,
      and(eq(analyticsEvents.event, event), gte(analyticsEvents.createdAt, dailyFrom)),
    );
    discoveryDaily[event] = fillDailySeries(DAILY_WINDOW_DAYS, rows);
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
    count: Number(row.count),
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
    views: Number(row.views),
  }));

  const [applicationsTotal, applicationsDaily, savedTotal, savedDaily] =
    await Promise.all([
      countWhere(applications),
      bucketCounts(
        applications,
        applications.createdAt,
        gte(applications.createdAt, dailyFrom),
      ),
      countWhere(savedJobs),
      bucketCounts(savedJobs, savedJobs.createdAt, gte(savedJobs.createdAt, dailyFrom)),
    ]);

  const [alertDeliveriesTotal, alertDeliveriesDaily, registrationsTotal, registrationsDaily] =
    await Promise.all([
      countWhere(jobAlertDeliveries),
      bucketCounts(
        jobAlertDeliveries,
        jobAlertDeliveries.sentAt,
        gte(jobAlertDeliveries.sentAt, dailyFrom),
      ),
      countWhere(users, eq(users.role, "CANDIDATE")),
      bucketCounts(
        users,
        users.createdAt,
        and(eq(users.role, "CANDIDATE"), gte(users.createdAt, dailyFrom)),
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

  const monetization = await getMonetizationCounts(now);

  return {
    window: {
      totalDays: TOTAL_WINDOW_DAYS,
      dailyDays: DAILY_WINDOW_DAYS,
      dateTo: now.toISOString(),
    },
    discovery: {
      totals: discoveryTotals,
      daily: discoveryDaily,
      byLocale,
      topViewedJobs,
    },
    engagement: {
      applications: { total: applicationsTotal, daily: fillDailySeries(DAILY_WINDOW_DAYS, applicationsDaily) },
      savedJobs: { total: savedTotal, daily: fillDailySeries(DAILY_WINDOW_DAYS, savedDaily) },
      alertDeliveries: {
        total: alertDeliveriesTotal,
        daily: fillDailySeries(DAILY_WINDOW_DAYS, alertDeliveriesDaily),
      },
      registrations: {
        total: registrationsTotal,
        daily: fillDailySeries(DAILY_WINDOW_DAYS, registrationsDaily),
      },
    },
    moderation: {
      jobPublished,
      jobRejected,
      jobReverified,
    },
    monetization,
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