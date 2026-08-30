export interface PasswordResetEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Injectable email transport boundary (Batch 75, extended Batch 83).
 *
 * The forgot-password flow depends only on sendPasswordResetEmail, not on any
 * concrete provider. Application status notifications use sendEmail. Tests
 * inject a mock; production wiring is isolated in the provider module.
 */
export type SendPasswordResetEmail = (
  email: PasswordResetEmail,
) => Promise<void>;

export type SendEmail = (email: EmailMessage) => Promise<void>;

export interface EmailTransport {
  sendPasswordResetEmail: SendPasswordResetEmail;
  sendEmail: SendEmail;
}
