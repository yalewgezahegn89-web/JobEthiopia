import type { EmailMessage } from "./types";

export interface ApplicationStatusNotification {
  applicationId: string;
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  organizationName: string;
  newStatus: string;
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

function statusLabel(status: string): string {
  switch (status) {
    case "REVIEWING":
      return "under review";
    case "SHORTLISTED":
      return "shortlisted";
    case "REJECTED":
      return "not selected";
    default:
      return status.toLowerCase();
  }
}

/**
 * Builds an application-status-change notification email for the candidate.
 *
 * Does NOT include: cover letter, resume, candidate ID, internal metadata,
 * reset tokens, or secrets. Only job title, organization name, and status
 * are included.
 */
export function buildApplicationStatusEmail(
  baseUrl: string,
  notification: ApplicationStatusNotification,
): EmailMessage {
  const { applicationId, candidateName, jobTitle, organizationName, newStatus } =
    notification;
  const label = statusLabel(newStatus);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeOrgName = escapeHtml(organizationName);
  const safeName = escapeHtml(candidateName);
  const applicationUrl = `${baseUrl}/applications/${applicationId}`;

  const subject = `Your application for "${jobTitle}" — ${newStatus}`;

  const text = [
    `Hi ${candidateName},`,
    "",
    `Your application for "${jobTitle}" at ${organizationName} has been updated.`,
    "",
    `Status: ${label}`,
    "",
    "You can view this application here:",
    applicationUrl,
    "",
    "If you have questions, please contact the organization directly.",
  ].join("\n");

  const html = [
    `<p>Hi ${safeName},</p>`,
    `<p>Your application for "<strong>${safeJobTitle}</strong>" at ${safeOrgName} has been updated.</p>`,
    `<p>Status: <strong>${escapeHtml(label)}</strong></p>`,
    `<p>You can <a href="${escapeHtml(applicationUrl)}">view this application</a> here.</p>`,
    "<p>If you have questions, please contact the organization directly.</p>",
  ].join("\n");

  return {
    to: notification.candidateEmail,
    subject,
    text,
    html,
  };
}
