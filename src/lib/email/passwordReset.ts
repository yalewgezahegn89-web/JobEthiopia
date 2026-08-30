import type { PasswordResetEmail } from "./types";

/**
 * Builds the password-reset email body. The reset token may only ever appear
 * inside the reset URL delivered to the recipient; it must never be persisted
 * or logged elsewhere.
 */
export function buildPasswordResetEmail(
  to: string,
  resetUrl: string,
): PasswordResetEmail {
  const subject = "Reset your password";

  const text = [
    "We received a request to reset your password.",
    "",
    `Reset your password here (valid for 30 minutes): ${resetUrl}`,
    "",
    "If you did not request this, you can safely ignore this email. Your",
    "password will not change unless you follow the link above.",
  ].join("\n");

  const html = [
    "<p>We received a request to reset your password.</p>",
    `<p><a href="${escapeHtml(resetUrl)}">Reset your password</a> (valid for 30 minutes).</p>`,
    "<p>If you did not request this, you can safely ignore this email. Your",
    "password will not change unless you follow the link above.</p>",
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
