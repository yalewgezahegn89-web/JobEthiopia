/**
 * Notification event helpers (Batch 4 — Notifications Inbox).
 *
 * Each function creates an in-app notification for a specific event.
 * All functions are best-effort and never throw — consistent with
 * the existing dispatch* pattern used for email notifications.
 */

import { createNotification } from "./dal";

export type ApplicationStatusNotification = {
  candidateUserId: string;
  applicationId: string;
  jobTitle: string;
  newStatus: string;
};

/**
 * Creates an in-app notification when an application's status changes.
 * Only notifies for statuses the candidate cares about.
 */
export async function notifyApplicationStatusChanged(
  input: ApplicationStatusNotification,
): Promise<void> {
  const NOTIFYABLE_STATUSES = new Set([
    "REVIEWING",
    "SHORTLISTED",
    "REJECTED",
  ]);

  if (!NOTIFYABLE_STATUSES.has(input.newStatus)) return;

  await createNotification({
    userId: input.candidateUserId,
    type: "application_status_changed",
    data: {
      applicationId: input.applicationId,
      jobTitle: input.jobTitle,
      status: input.newStatus,
    },
    actionUrl: `/applications/${input.applicationId}`,
  });
}

export type JobAlertMatchNotification = {
  userId: string;
  alertName: string;
  matchCount: number;
};

/**
 * Creates an in-app notification when a job alert matches new jobs.
 * Only notifies when there are actual matches.
 */
export async function notifyJobAlertMatch(
  input: JobAlertMatchNotification,
): Promise<void> {
  if (input.matchCount <= 0) return;

  await createNotification({
    userId: input.userId,
    type: "job_alert_match",
    data: {
      alertName: input.alertName,
      matchCount: input.matchCount,
    },
    actionUrl: "/saved-jobs",
  });
}
