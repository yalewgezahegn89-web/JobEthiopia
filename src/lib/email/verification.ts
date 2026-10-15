import type { EmailMessage } from "./types";

/**
 * Builds the email verification email body. The verification token may only
 * ever appear inside the verification URL delivered to the recipient; it must
 * never be persisted or logged elsewhere.
 */
export function buildVerificationEmail(
  to: string,
  verifyUrl: string,
): EmailMessage {
  const subject = "Verify your email address";

  const text = [
    "Please verify your email address to complete your registration.",
    "",
    `Click here to verify (valid for 24 hours): ${verifyUrl}`,
    "",
    "If you did not create an account, you can safely ignore this email.",
  ].join("\n");

  const html = [
    "<p>Please verify your email address to complete your registration.</p>",
    `<p><a href="${escapeHtml(verifyUrl)}">Verify your email</a> (valid for 24 hours).</p>`,
    "<p>If you did not create an account, you can safely ignore this email.</p>",
  ].join("\n");

  return { to, subject, text, html };
}

/**
 * Builds the email change verification email body.
 */
export function buildEmailChangeVerificationEmail(
  to: string,
  verifyUrl: string,
): EmailMessage {
  const subject = "Verify your new email address";

  const text = [
    "We received a request to change your email address.",
    "",
    `Click here to verify your new email (valid for 24 hours): ${verifyUrl}`,
    "",
    "If you did not request this change, you can safely ignore this email.",
    "Your current email will remain unchanged until you verify the new one.",
  ].join("\n");

  const html = [
    "<p>We received a request to change your email address.</p>",
    `<p><a href="${escapeHtml(verifyUrl)}">Verify your new email</a> (valid for 24 hours).</p>`,
    "<p>If you did not request this change, you can safely ignore this email.</p>",
    "<p>Your current email will remain unchanged until you verify the new one.</p>",
  ].join("\n");

  return { to, subject, text, html };
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
