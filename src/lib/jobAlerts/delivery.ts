/**
 * Job-alert delivery (Phase 7 Batch 6).
 *
 * - Daily digest: sweeps ACTIVE/DAILY alerts that have not been served in the
 *   last ~23 hours, matches, sends one localized email per alert, and records
 *   per-job delivery rows (dedup).
 * - Instant: dispatched from the admin publish path for a single newly
 *   published job (see @/lib/jobAlerts/delivery::dispatchInstantAlertsForJob).
 * - Unsubscribe: a per-alert opaque token (SHA-256, stored hash only) gives a
 *   one-click unsubscribe link. Tokens are rotated on every send so the newest
 *   email always carries the newest link.
 *
 * Sending rule: an alert is only delivered to a user whose email is present
 * and non-empty (users.email is nullable for phone-first accounts). When the
 * email is missing the match is recorded as SKIPPED_NO_EMAIL so it is not
 * replayed later.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { jobAlerts } from "@/db/schema/jobAlerts";
import { jobAlertDeliveries } from "@/db/schema/jobAlertDeliveries";
import { users } from "@/db/schema/users";
import { dispatchJobAlertEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/auth/audit";
import { getAppBaseUrl } from "@/lib/auth/csrf";
import type { Locale } from "@/lib/i18n/locale";
import { matchJobsForAlert, type MatchedJob } from "./matching";
import type { JobAlertRow } from "./dal";

const UNSUBSCRIBE_TOKEN_BYTES = 32;
const UNSUBSCRIBE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DIGEST_MIN_INTERVAL_MS = 23 * 60 * 60 * 1000;

/* ── Unsubscribe tokens ───────────────────────────────────────────────── */

export function hashUnsubscribeToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Rotates the alert's unsubscribe token and returns the new raw token. The
 * stored hash is updated; the raw token is returned only to the email builder
 * that embeds it in the link. Tokens expire after 90 days.
 */
export async function createUnsubscribeToken(alertId: string): Promise<string> {
  const rawToken = randomBytes(UNSUBSCRIBE_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + UNSUBSCRIBE_TOKEN_TTL_MS);

  await db
    .update(jobAlerts)
    .set({
      unsubscribeTokenHash: hashUnsubscribeToken(rawToken),
      unsubscribeTokenExpiresAt: expiresAt,
    })
    .where(eq(jobAlerts.id, alertId));

  return rawToken;
}

/**
 * Unsubscribes an alert via its raw token. Idempotent: an already-unsubscribed
 * or revoked token still resolves to success. Returns false for unknown or
 * expired tokens.
 */
export async function unsubscribeAlertWithToken(
  rawToken: string,
): Promise<boolean> {
  if (!rawToken) return false;

  const tokenHash = hashUnsubscribeToken(rawToken);
  const alert = await db.query.jobAlerts.findFirst({
    where: and(
      eq(jobAlerts.unsubscribeTokenHash, tokenHash),
      isNotNull(jobAlerts.unsubscribeTokenExpiresAt),
    ),
  });
  if (!alert) return false;

  const expiresAt = alert.unsubscribeTokenExpiresAt;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return false;

  await db
    .update(jobAlerts)
    .set({
      status: "UNSUBSCRIBED",
      unsubscribeTokenHash: null,
      unsubscribeTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobAlerts.id, alert.id));

  await writeAuditLog({
    action: "JOB_ALERT_UNSUBSCRIBED",
    targetType: "job_alert",
    targetId: alert.id,
    metadata: { channel: "email_link" },
  }).catch(() => undefined);

  return true;
}

/* ── Delivery ─────────────────────────────────────────────────────────── */

export interface DeliveryOutcome {
  alertId: string;
  emailDelivered: boolean;
  delivered: number;
  skippedNoEmail: number;
  failed: number;
}

function alertLocale(value: string): Locale {
  return value === "am" || value === "om" ? value : "en";
}

async function resolveRecipientEmail(alert: JobAlertRow): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, alert.userId),
    columns: { email: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  const email = user.email?.trim();
  return email ? email : null;
}

export async function deliverJobAlert(
  alert: JobAlertRow,
  options: { restrictJobIds?: string[]; limit?: number; now?: Date } = {},
): Promise<DeliveryOutcome> {
  const outcome: DeliveryOutcome = {
    alertId: alert.id,
    emailDelivered: false,
    delivered: 0,
    skippedNoEmail: 0,
    failed: 0,
  };

  const emailAddress = await resolveRecipientEmail(alert);

  const matches: MatchedJob[] = await matchJobsForAlert(alert, {
    ...options,
    limit: options.limit ?? 20,
    now: options.now,
  });

  if (matches.length === 0) {
    return outcome;
  }

  if (!emailAddress) {
    await recordDelivery(alert.id, matches, "SKIPPED_NO_EMAIL");
    outcome.skippedNoEmail = matches.length;
    return outcome;
  }

  const baseUrl = getAppBaseUrl();
  const unsubscribeUrl = `${baseUrl}/api/job-alerts/unsubscribe?token=${encodeURIComponent(
    await createUnsubscribeToken(alert.id),
  )}&locale=${alertLocale(alert.locale)}`;

  const sent = await dispatchJobAlertEmail(emailAddress, alertLocale(alert.locale), {
    alertName: alert.name,
    keywords: alert.keywords,
    jobs: matches,
    baseUrl,
    unsubscribeUrl,
  });

  await recordDelivery(alert.id, matches, sent ? "SENT" : "FAILED");

  if (sent) {
    outcome.emailDelivered = true;
    outcome.delivered = matches.length;
    await db
      .update(jobAlerts)
      .set({ lastSentAt: new Date() })
      .where(eq(jobAlerts.id, alert.id));
  } else {
    outcome.failed = matches.length;
  }

  return outcome;
}

async function recordDelivery(
  alertId: string,
  matches: MatchedJob[],
  status: "SENT" | "SKIPPED_NO_EMAIL" | "FAILED",
): Promise<void> {
  if (matches.length === 0) return;
  await db
    .insert(jobAlertDeliveries)
    .values(
      matches.map((job) => ({
        alertId,
        jobId: job.id,
        status,
      })),
    )
    .onConflictDoNothing();
}

export interface DigestResult {
  alertsProcessed: number;
  alertsSkipped: number;
  sent: number;
  skippedNoEmail: number;
  failed: number;
  emailsSent: number;
}

/**
 * Atomically claims a due alert for this digest run. Only the first runner can
 * claim an alert (conditional UPDATE on the ~23h not-served window), so two
 * overlapping digests cannot both email the same subscriber. Returns false
 * when another run already claimed it.
 */
async function claimAlertForDigest(
  alertId: string,
  reference: Date,
  minLastSent: Date,
): Promise<boolean> {
  const claimed = await db
    .update(jobAlerts)
    .set({ lastSentAt: reference, updatedAt: reference })
    .where(
      and(
        eq(jobAlerts.id, alertId),
        or(isNull(jobAlerts.lastSentAt), lte(jobAlerts.lastSentAt, minLastSent)),
      ),
    )
    .returning({ id: jobAlerts.id });

  return claimed.length === 1;
}

async function restoreAlertClaim(
  alertId: string,
  previousLastSentAt: Date | null,
): Promise<void> {
  await db
    .update(jobAlerts)
    .set({ lastSentAt: previousLastSentAt, updatedAt: new Date() })
    .where(eq(jobAlerts.id, alertId));
}

/**
 * Runs the daily digest: every ACTIVE/DAILY alert that has not been served in
 * the last ~23 hours is matched and delivered. Never throws; failures are
 * counted per outcome so a single bad alert cannot block the batch. Each alert
 * is claimed first (see claimAlertForDigest) so overlapping runs cannot both
 * email the same subscriber.
 */
export async function dispatchDailyDigests(now?: Date): Promise<DigestResult> {
  const reference = now ?? new Date();
  const minLastSent = new Date(reference.getTime() - DIGEST_MIN_INTERVAL_MS);

  const alerts = await db.query.jobAlerts.findMany({
    where: and(
      eq(jobAlerts.status, "ACTIVE"),
      eq(jobAlerts.frequency, "DAILY"),
      or(
        isNull(jobAlerts.lastSentAt),
        lte(jobAlerts.lastSentAt, minLastSent),
      ),
    ),
  });

  const result: DigestResult = {
    alertsProcessed: 0,
    alertsSkipped: 0,
    sent: 0,
    skippedNoEmail: 0,
    failed: 0,
    emailsSent: 0,
  };

  for (const alert of alerts) {
    result.alertsProcessed++;
    const previousLastSentAt = alert.lastSentAt;

    try {
      const claimed = await claimAlertForDigest(alert.id, reference, minLastSent);
      if (!claimed) {
        // Claimed by an overlapping run (or already served concurrently).
        result.alertsSkipped++;
        continue;
      }

      const outcome = await deliverJobAlert(alert, { now: reference });
      result.sent += outcome.delivered;
      result.skippedNoEmail += outcome.skippedNoEmail;
      result.failed += outcome.failed;
      if (outcome.emailDelivered) result.emailsSent++;

      if (!outcome.emailDelivered) {
        // Nothing actually emailed (no matches, no email on file, or transport
        // failure): release the claim so the alert stays due for the next run.
        await restoreAlertClaim(alert.id, previousLastSentAt).catch(
          () => undefined,
        );
        if (outcome.skippedNoEmail === 0 && outcome.failed === 0) {
          result.alertsSkipped++;
        }
      }
    } catch {
      // A failed digest for one alert must not block the others.
      await restoreAlertClaim(alert.id, previousLastSentAt).catch(() => undefined);
      result.failed += 1;
    }
  }

  return result;
}

/**
 * Instant delivery for a job that just became publicly eligible. Called from
 * the admin publish path; never throws so a delivery problem can never fail a
 * publish.
 */
export async function dispatchInstantAlertsForJob(
  jobId: string,
): Promise<DigestResult> {
  const empty = {
    alertsProcessed: 0,
    alertsSkipped: 0,
    sent: 0,
    skippedNoEmail: 0,
    failed: 0,
    emailsSent: 0,
  } satisfies DigestResult;

  try {
    const alerts = await db.query.jobAlerts.findMany({
      where: and(
        eq(jobAlerts.status, "ACTIVE"),
        eq(jobAlerts.frequency, "INSTANT"),
      ),
    });

    const result: DigestResult = { ...empty };
    for (const alert of alerts) {
      result.alertsProcessed++;
      try {
        const outcome = await deliverJobAlert(alert, {
          restrictJobIds: [jobId],
          limit: 10,
        });
        result.sent += outcome.delivered;
        result.skippedNoEmail += outcome.skippedNoEmail;
        result.failed += outcome.failed;
        if (outcome.emailDelivered) result.emailsSent++;
      } catch {
        result.failed += 1;
      }
    }
    return result;
  } catch {
    return empty;
  }
}