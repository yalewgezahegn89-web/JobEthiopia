import type {
  EmailTransport,
  PasswordResetEmail,
  SendPasswordResetEmail,
} from "./types";
import { buildPasswordResetEmail } from "./passwordReset";

export { buildPasswordResetEmail };
export type { EmailTransport, PasswordResetEmail, SendPasswordResetEmail } from "./types";

/**
 * Default transport: a deliberate no-op.
 *
 * No live email is sent and nothing is logged (reset URLs/tokens are never
 * written to logs). A real provider must be registered via setEmailTransport
 * once a verified production domain/HTTPS URL exists (see REPORT: the
 * production domain is not yet established, so live provider wiring is
 * intentionally left isolated/out of this engine's default path).
 */
const noopTransport: EmailTransport = {
  async sendPasswordResetEmail(): Promise<void> {
    // Intentionally does nothing.
  },
};

let transport: EmailTransport = noopTransport;

/** Registers the active transport. Tests use this to inject a mock. */
export function setEmailTransport(next: EmailTransport): void {
  transport = next;
}

/** Overridable send entry point used by the forgot-password flow. */
export const sendPasswordResetEmail: SendPasswordResetEmail = async (
  email: PasswordResetEmail,
): Promise<void> => {
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
  await sendPasswordResetEmail(buildPasswordResetEmail(to, resetUrl));
}
