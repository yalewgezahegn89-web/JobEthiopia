/**
 * Job-alert data access (Phase 7 Batch 6).
 *
 * Ownership is enforced inside every read/write: every mutation is scoped by
 * the caller's user id taken from the session, so one candidate can never read
 * or mutate another candidate's alerts.
 */
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { jobAlerts } from "@/db/schema/jobAlerts";
import type {
  CreateJobAlertInput,
  UpdateJobAlertInput,
} from "@/lib/validations";

export type JobAlertRow = typeof jobAlerts.$inferSelect;

export async function listAlertsForUser(
  userId: string,
): Promise<JobAlertRow[]> {
  return db.query.jobAlerts.findMany({
    where: eq(jobAlerts.userId, userId),
    orderBy: [desc(jobAlerts.createdAt)],
    limit: 100,
  });
}

export async function getAlertForUser(
  alertId: string,
  userId: string,
): Promise<JobAlertRow | null> {
  const row = await db.query.jobAlerts.findFirst({
    where: and(eq(jobAlerts.id, alertId), eq(jobAlerts.userId, userId)),
  });
  return row ?? null;
}

export async function createAlert(
  userId: string,
  input: CreateJobAlertInput,
): Promise<JobAlertRow> {
  const [created] = await db
    .insert(jobAlerts)
    .values({
      userId,
      name: input.name,
      keywords: input.keywords ? input.keywords : null,
      categoryId: input.categoryId ?? null,
      professionId: input.professionId ?? null,
      locationId: input.locationId ?? null,
      employmentType: (input.employmentType as never) ?? null,
      frequency: input.frequency as never,
      locale: input.locale,
    })
    .returning();

  return created;
}

/**
 * Applies the fields present in the update input. A present `null` clears the
 * filter (e.g. removing the employment-type restriction); an absent key leaves
 * the stored value untouched. Returns null when the alert does not belong to
 * the user (or does not exist).
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  input: UpdateJobAlertInput,
): Promise<JobAlertRow | null> {
  const values: Record<string, unknown> = {};

  if ("name" in input && input.name !== undefined) values.name = input.name;
  if ("keywords" in input) {
    values.keywords = input.keywords ? input.keywords : null;
  }
  if ("categoryId" in input) values.categoryId = input.categoryId ?? null;
  if ("professionId" in input) values.professionId = input.professionId ?? null;
  if ("locationId" in input) values.locationId = input.locationId ?? null;
  if ("employmentType" in input) {
    values.employmentType = (input.employmentType as never) ?? null;
  }
  if ("frequency" in input && input.frequency !== undefined) {
    values.frequency = input.frequency as never;
  }
  if ("locale" in input && input.locale !== undefined) values.locale = input.locale;
  if ("status" in input && input.status !== undefined) {
    values.status = input.status as never;
  }

  const [updated] = await db
    .update(jobAlerts)
    .set(values)
    .where(and(eq(jobAlerts.id, alertId), eq(jobAlerts.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Deletes an alert owned by the user. Returns true only when a row was
 * actually deleted (i.e. the limit belongs to this user).
 */
export async function deleteAlert(
  alertId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(jobAlerts)
    .where(and(eq(jobAlerts.id, alertId), eq(jobAlerts.userId, userId)))
    .returning({ id: jobAlerts.id });

  return rows.length > 0;
}