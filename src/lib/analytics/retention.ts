/**
 * Analytics retention policy.
 *
 * Raw discovery events are pruned after a rolling window (default 365 days)
 * to bound storage and honor data minimization. Reports are aggregates, so
 * deleting historical raw rows is intentional.
 */
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";

export const DEFAULT_ANALYTICS_RETENTION_DAYS = 365;

/** Cutoff timestamp before which raw analytics rows should be pruned. */
export function analyticsRetentionCutoff(
  now: Date,
  retentionDays: number = DEFAULT_ANALYTICS_RETENTION_DAYS,
): Date {
  return new Date(now.getTime() - retentionDays * 86_400_000);
}

export async function pruneAnalyticsEvents(
  now: Date,
  retentionDays: number = DEFAULT_ANALYTICS_RETENTION_DAYS,
): Promise<{ pruned: number }> {
  const cutoff = analyticsRetentionCutoff(now, retentionDays);

  const result = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.createdAt, cutoff));

  return { pruned: result.rowCount ?? 0 };
}