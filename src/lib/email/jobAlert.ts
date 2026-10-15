/**
 * Job-alert notification email builder (Phase 7 Batch 6).
 *
 * Headings, labels, and footers are localized into the alert's saved locale
 * (en/am/om). Job content (title, organization, location, deadline, links) is
 * rendered verbatim and HTML-escaped — job content is never translated.
 */
import type { EmailMessage } from "./types";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/jobs/public";
import type { MatchedJob } from "@/lib/jobAlerts/matching";

export interface JobAlertNotification {
  alertName: string;
  keywords: string | null;
  jobs: MatchedJob[];
  baseUrl: string;
  unsubscribeUrl: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function jobListingText(job: MatchedJob, baseUrl: string, deadlineLabel: string): string[] {
  const lines: string[] = [];

  const meta = [job.organizationName, job.locationName]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  lines.push(job.title);
  if (meta) lines.push(meta);
  const deadline = formatDate(job.deadline);
  if (deadline) lines.push(`${deadlineLabel} ${deadline}`);
  lines.push(`${baseUrl}/jobs/${job.id}`);
  lines.push("");

  return lines;
}

function jobListingHtml(job: MatchedJob, baseUrl: string): string {
  const safeTitle = escapeHtml(job.title);
  const meta = [job.organizationName, job.locationName]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const jobUrl = `${baseUrl}/jobs/${job.id}`;

  return [
    `<li style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">`,
    `<p style="margin:0;font-size:15px;"><a href="${escapeHtml(jobUrl)}" style="color:#1d4ed8;font-weight:600;text-decoration:none;">${safeTitle}</a></p>`,
    meta ? `<p style="margin:4px 0 0;color:#4b5563;font-size:13px;">${escapeHtml(meta)}</p>` : "",
    `</li>`,
  ].join("");
}

/**
 * Builds a localized job-alert email for a set of matched jobs.
 *
 * The recipient address is intentionally left empty; the dispatcher stamps it
 * from the trusted users.email value. Never includes raw unsubscribe tokens or
 * any secret beyond the link the recipient will click.
 */
export function buildJobAlertEmail(
  locale: Locale,
  notification: JobAlertNotification,
): EmailMessage {
  const t = dictionaries[locale].jobAlerts.email;

  const safeAlertName = escapeHtml(notification.alertName);
  const safeKeywords = notification.keywords
    ? escapeHtml(notification.keywords)
    : null;
  const count = notification.jobs.length;
  const subject = `${t.subjectPrefix(notification.alertName)} — ${count}`;
  const textIntro = t.intro(notification.alertName);

  const text = [
    textIntro,
    "",
    ...notification.jobs.flatMap((job) =>
      jobListingText(job, notification.baseUrl, t.deadlineLabel),
    ),
    t.footer,
    "",
    `${t.manageAlerts}: ${notification.baseUrl}/job-alerts`,
    `${t.unsubscribe}: ${notification.unsubscribeUrl}`,
  ].join("\n");

  const html = [
    `<p style="margin:0 0 12px;">${escapeHtml(t.intro(notification.alertName))}</p>`,
    count > 0
      ? `<ul style="margin:0;padding:0;list-style:none;">${notification.jobs
          .map((job) => jobListingHtml(job, notification.baseUrl))
          .join("")}</ul>`
      : "",
    `<p style="margin:16px 0 0;color:#6b7280;font-size:12px;">${safeAlertName} · ${
      safeKeywords ? `Keywords: ${safeKeywords}` : t.noKeywords
    } · ${t.countLabel(count)}</p>`,
    `<p style="margin:12px 0 0;color:#6b7280;font-size:12px;">${t.footer}</p>`,
    `<p style="margin:8px 0 0;font-size:12px;"><a href="${escapeHtml(
      `${notification.baseUrl}/job-alerts`,
    )}" style="color:#4b5563;">${t.manageAlerts}</a> · <a href="${escapeHtml(
      notification.unsubscribeUrl,
    )}" style="color:#4b5563;">${t.unsubscribe}</a></p>`,
  ].join("\n");

  return {
    to: "",
    subject,
    text,
    html,
  };
}