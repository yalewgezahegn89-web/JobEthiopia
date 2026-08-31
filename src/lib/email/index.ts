import type {
  EmailTransport,
  PasswordResetEmail,
  SendPasswordResetEmail,
} from "./types";
import { buildPasswordResetEmail } from "./passwordReset";
import { buildApplicationStatusEmail, buildApplicationSubmissionEmail } from "./notification";
import type { ApplicationStatusNotification } from "./notification";
import type { ApplicationSubmissionNotification } from "./notification";
import { getAppBaseUrl } from "@/lib/auth/csrf";
import { logInfo, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

export { buildPasswordResetEmail, buildApplicationStatusEmail, buildApplicationSubmissionEmail };
export type {
  EmailTransport,
  PasswordResetEmail,
  SendPasswordResetEmail,
} from "./types";
export type { ApplicationStatusNotification } from "./notification";
export type { ApplicationSubmissionNotification } from "./notification";

/* ── Transport selection ──────────────────────────────────────────────── */

/**
 * Default transport: a deliberate no-op.
 *
 * No live email is sent and nothing is logged (reset URLs/tokens are never
 * written to logs). A real provider becomes active when RESEND_API_KEY and
 * EMAIL_FROM are configured in the environment.
 */
const noopTransport: EmailTransport = {
  async sendPasswordResetEmail(): Promise<void> {
    // Intentionally does nothing.
  },
  async sendEmail(): Promise<void> {
    // Intentionally does nothing.
  },
};

let transport: EmailTransport = noopTransport;
let transportInitialized = false;

/**
 * Lazily initializes the email transport on first use. If RESEND_API_KEY
 * and EMAIL_FROM are present, a Resend transport is created. Otherwise
 * the noop transport remains active.
 *
 * This avoids module-level side effects that break tests.
 */
async function ensureTransport(): Promise<void> {
  if (transportInitialized) return;
  transportInitialized = true;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    try {
      const { createResendTransport } = await import("./resend");
      transport = createResendTransport();
    } catch {
      // If Resend transport creation fails, remain noop and log once
      logError("email_transport_init_failed", {
        errorCode: "RESEND_INIT_FAILED",
      });
    }
  }
}

/** Registers the active transport. Tests use this to inject a mock. */
export function setEmailTransport(next: EmailTransport): void {
  transport = next;
  transportInitialized = true;
}

/** Resets transport state to noop. Used in test teardown. */
export function resetEmailTransport(): void {
  transport = noopTransport;
  transportInitialized = false;
}

/* ── Password reset ───────────────────────────────────────────────────── */

/** Overridable send entry point used by the forgot-password flow. */
export const sendPasswordResetEmail: SendPasswordResetEmail = async (
  email: PasswordResetEmail,
): Promise<void> => {
  await ensureTransport();
  await transport.sendPasswordResetEmail(email);
};

/**
 * Sends a password-reset email to a recipient via the active transport.
 * Builds the email from the un-persisted reset URL.
 */
export async function dispatchPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  try {
    await sendPasswordResetEmail(buildPasswordResetEmail(to, resetUrl));
    logInfo("email_send_succeeded", {
      requestId: await getRequestId(),
      emailType: "password_reset",
      recipientType: "user",
    });
  } catch (err) {
    // Operational logging only. Never log the URL/token/body/secret; emit a
    // stable code and the correlation ID so failures remain diagnosable.
    logError("email_send_failed", {
      requestId: await getRequestId(),
      emailType: "password_reset",
      errorCode: "EMAIL_DISPATCH_FAILED",
    });
    throw err;
  }
}

/* ── Application status notification ──────────────────────────────────── */

/**
 * Dispatches an application-status-change notification to the candidate.
 * Must be called AFTER the business transaction has committed.
 *
 * Never throws: email failure is logged and swallowed so the caller's
 * response is unaffected.
 */
export async function dispatchApplicationStatusNotification(
  notification: ApplicationStatusNotification,
): Promise<void> {
  try {
    await ensureTransport();
    const email = buildApplicationStatusEmail(getAppBaseUrl(), notification);
    await transport.sendEmail(email);
    logInfo("email_send_succeeded", {
      requestId: await getRequestId(),
      emailType: "application_status",
      recipientType: "candidate",
    });
  } catch {
    logError("email_send_failed", {
      requestId: await getRequestId(),
      emailType: "application_status",
      errorCode: "EMAIL_DISPATCH_FAILED",
    });
  }
}

/* ── Application submission confirmation ─────────────────────────────── */

/**
 * Dispatches a transactional confirmation email to the candidate after their
 * application was successfully created. Must be called AFTER the business
 * transaction has committed.
 *
 * Never throws: email failure is logged and swallowed so the caller's 201
 * response is unaffected. Only the recipient type, email type and a stable
 * error code are logged; the recipient address, application URL and body are
 * never written to logs.
 */
export async function dispatchApplicationSubmissionNotification(
  recipient: string,
  notification: ApplicationSubmissionNotification,
): Promise<void> {
  try {
    await ensureTransport();
    const email = buildApplicationSubmissionEmail(getAppBaseUrl(), notification);
    await transport.sendEmail({ ...email, to: recipient });
    logInfo("email_send_succeeded", {
      requestId: await getRequestId(),
      emailType: "application_submission",
      recipientType: "candidate",
    });
  } catch {
    logError("email_send_failed", {
      requestId: await getRequestId(),
      emailType: "application_submission",
      errorCode: "EMAIL_DISPATCH_FAILED",
    });
  }
}
