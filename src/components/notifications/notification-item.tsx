"use client";

import Link from "next/link";
import type { ClientNotification } from "./notification-list";

export type NotificationMessages = {
  typeApplicationStatusChanged: string;
  typeJobAlertMatch: string;
  typeEmployerNewApplication: string;
  typeEmployerApplicationWithdrawn: string;
  typeEmployerJobStatusChanged: string;
  typeEmployerOnboardingApproved: string;
  typeEmployerOnboardingRejected: string;
  typeAccountSecurity: string;
  accountSecurityPasswordChanged: string;
  accountSecurityEmailChangeRequested: string;
  accountSecurityEmailChanged: string;
  accountSecurityEmailVerified: string;
  accountSecuritySessionRevoked: string;
  accountSecurityOtherSessionsRevoked: string;
  statusSubheading: (jobTitle: string, status: string) => string;
  alertMatchSubheading: (count: number, alertName: string) => string;
  employerNewApplicationSubheading: (jobTitle: string, candidateName: string) => string;
  employerApplicationWithdrawnSubheading: (jobTitle: string, candidateName: string) => string;
  employerJobStatusSubheading: (jobTitle: string, status: string) => string;
  employerOnboardingApprovedSubheading: (organizationName: string) => string;
  employerOnboardingRejectedSubheading: (organizationName: string) => string;
  viewApplication: string;
  viewJob: string;
  viewWorkspace: string;
  markRead: string;
  delete: string;
  unreadLabel: string;
  readLabel: string;
};

type Props = {
  item: ClientNotification;
  t: NotificationMessages;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
};

function resolveNotificationDisplay(
  item: ClientNotification,
  t: NotificationMessages,
) {
  const data = (item.data ?? {}) as Record<string, unknown>;

  if (item.type === "account_security") {
    return {
      title: t.typeAccountSecurity,
      subheading: accountSecurityEventText(t, String(data.event ?? "")),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewApplication,
    };
  }

  if (item.type === "application_status_changed") {
    const jobTitle = String(data.jobTitle ?? "Job");
    const status = String(data.status ?? "");
    return {
      title: t.typeApplicationStatusChanged,
      subheading: t.statusSubheading(jobTitle, status),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewApplication,
    };
  }

  if (item.type === "job_alert_match") {
    const alertName = String(data.alertName ?? "Alert");
    const matchCount = Number(data.matchCount ?? 0);
    return {
      title: t.typeJobAlertMatch,
      subheading: t.alertMatchSubheading(matchCount, alertName),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewApplication,
    };
  }

  if (item.type === "employer_new_application") {
    const jobTitle = String(data.jobTitle ?? "Job");
    const candidateName = String(data.candidateName ?? "Candidate");
    return {
      title: t.typeEmployerNewApplication,
      subheading: t.employerNewApplicationSubheading(jobTitle, candidateName),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewApplication,
    };
  }

  if (item.type === "employer_application_withdrawn") {
    const jobTitle = String(data.jobTitle ?? "Job");
    const candidateName = String(data.candidateName ?? "Candidate");
    return {
      title: t.typeEmployerApplicationWithdrawn,
      subheading: t.employerApplicationWithdrawnSubheading(jobTitle, candidateName),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewApplication,
    };
  }

  if (item.type === "employer_job_status_changed") {
    const jobTitle = String(data.jobTitle ?? "Job");
    const status = String(data.status ?? "");
    return {
      title: t.typeEmployerJobStatusChanged,
      subheading: t.employerJobStatusSubheading(jobTitle, status),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewJob,
    };
  }

  if (item.type === "employer_onboarding_approved") {
    const organizationName = String(data.organizationName ?? "Organization");
    return {
      title: t.typeEmployerOnboardingApproved,
      subheading: t.employerOnboardingApprovedSubheading(organizationName),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewWorkspace,
    };
  }

  if (item.type === "employer_onboarding_rejected") {
    const organizationName = String(data.organizationName ?? "Organization");
    return {
      title: t.typeEmployerOnboardingRejected,
      subheading: t.employerOnboardingRejectedSubheading(organizationName),
      href: item.actionUrl ?? undefined,
      linkLabel: t.viewWorkspace,
    };
  }

  return {
    title: item.type,
    subheading: null,
    href: item.actionUrl ?? undefined,
    linkLabel: t.viewApplication,
  };
}

function accountSecurityEventText(
  t: NotificationMessages,
  event: string,
): string | null {
  switch (event) {
    case "password_changed":
      return t.accountSecurityPasswordChanged;
    case "email_change_requested":
      return t.accountSecurityEmailChangeRequested;
    case "email_changed":
      return t.accountSecurityEmailChanged;
    case "email_verified":
      return t.accountSecurityEmailVerified;
    case "session_revoked":
      return t.accountSecuritySessionRevoked;
    case "other_sessions_revoked":
      return t.accountSecurityOtherSessionsRevoked;
    default:
      return null;
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationItem({
  item,
  t,
  onMarkRead,
  onDelete,
  disabled,
}: Props) {
  const isUnread = item.readAt === null;
  const display = resolveNotificationDisplay(item, t);

  return (
    <li
      className={`relative flex gap-4 px-4 py-4 sm:px-6 ${
        isUnread ? "bg-primary-light/30" : ""
      }`}
    >
      {isUnread && (
        <span className="absolute left-1 top-6 h-2 w-2 rounded-full bg-primary" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {display.title}
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isUnread
                ? "bg-primary-light text-primary"
                : "bg-surface-raised text-muted"
            }`}
          >
            {isUnread ? t.unreadLabel : t.readLabel}
          </span>
        </div>

        {display.subheading && (
          <p className="mt-1 text-sm leading-5 text-muted">
            {display.subheading}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted">
            {timeAgo(item.createdAt)}
          </span>

          {display.href && (
            <Link
              href={display.href}
              className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {display.linkLabel}
            </Link>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        {isUnread && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMarkRead(item.id)}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
          >
            {t.markRead}
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDelete(item.id)}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {t.delete}
        </button>
      </div>
    </li>
  );
}
