/**
 * Notification event helpers (Batch 4 — Notifications Inbox, Batch 7 — Employer L1).
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

// ─── Employer notification events (Batch 7) ───────────────────────────────

export type EmployerNewApplicationNotification = {
  employerUserId: string;
  applicationId: string;
  jobTitle: string;
  candidateName: string;
};

/**
 * Creates an in-app notification for an employer when a new application is
 * received for one of their jobs.
 */
export async function notifyEmployerNewApplication(
  input: EmployerNewApplicationNotification,
): Promise<void> {
  await createNotification({
    userId: input.employerUserId,
    type: "employer_new_application",
    data: {
      applicationId: input.applicationId,
      jobTitle: input.jobTitle,
      candidateName: input.candidateName,
    },
    actionUrl: `/organization/applications/${input.applicationId}`,
  });
}

export type EmployerApplicationWithdrawnNotification = {
  employerUserId: string;
  applicationId: string;
  jobTitle: string;
  candidateName: string;
};

/**
 * Creates an in-app notification for an employer when a candidate withdraws
 * their application.
 */
export async function notifyEmployerApplicationWithdrawn(
  input: EmployerApplicationWithdrawnNotification,
): Promise<void> {
  await createNotification({
    userId: input.employerUserId,
    type: "employer_application_withdrawn",
    data: {
      applicationId: input.applicationId,
      jobTitle: input.jobTitle,
      candidateName: input.candidateName,
    },
    actionUrl: `/organization/applications/${input.applicationId}`,
  });
}

export type EmployerJobStatusNotification = {
  employerUserId: string;
  jobId: string;
  jobTitle: string;
  newStatus: string;
};

/**
 * Creates an in-app notification for an employer when a job's moderation
 * status changes (approved, rejected, etc.).
 */
export async function notifyEmployerJobStatusChanged(
  input: EmployerJobStatusNotification,
): Promise<void> {
  const NOTIFYABLE_STATUSES = new Set([
    "PUBLISHED",
    "REJECTED",
  ]);

  if (!NOTIFYABLE_STATUSES.has(input.newStatus)) return;

  await createNotification({
    userId: input.employerUserId,
    type: "employer_job_status_changed",
    data: {
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      status: input.newStatus,
    },
    actionUrl: `/organization/jobs/${input.jobId}`,
  });
}

export type EmployerOnboardingApprovalNotification = {
  userId: string;
  organizationName: string;
};

/**
 * Creates an in-app notification when a staff member approves an employer
 * onboarding request. Points the new employer at their workspace.
 */
export async function notifyEmployerOnboardingApproved(
  input: EmployerOnboardingApprovalNotification,
): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "employer_onboarding_approved",
    data: { organizationName: input.organizationName },
    actionUrl: "/organization",
  });
}

/**
 * Creates an in-app notification when a staff member rejects an employer
 * onboarding request. Points the applicant back at their request status page
 * where rejection feedback and the re-submission form live.
 */
export async function notifyEmployerOnboardingRejected(
  input: EmployerOnboardingApprovalNotification,
): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "employer_onboarding_rejected",
    data: { organizationName: input.organizationName },
    actionUrl: "/employer/status",
  });
}

// ─── Account security events (Phase 12) ─────────────────────────────────

export type AccountSecurityEvent =
  | "password_changed"
  | "email_change_requested"
  | "email_changed"
  | "email_verified"
  | "session_revoked"
  | "other_sessions_revoked";

/**
 * Creates an in-app notification when an account security event occurs
 * (password changed, email changed, other sessions revoked). Best-effort and
 * never throws, consistent with the other event helpers.
 */
export async function notifyAccountSecurity(
  userId: string,
  event: AccountSecurityEvent,
  extraData: Record<string, unknown> = {},
): Promise<void> {
  await createNotification({
    userId,
    type: "account_security",
    data: {
      event,
      ...extraData,
      occurredAt: new Date().toISOString(),
    },
    actionUrl: "/settings",
  });
}
