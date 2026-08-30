export interface PasswordResetEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Injectable email transport boundary (Batch 75).
 *
 * The forgot-password flow depends only on this function, not on any concrete
 * provider. Tests inject a mock; production wiring is left isolated in the
 * provider module so the engine never hard-depends on a vendor.
 */
export type SendPasswordResetEmail = (
  email: PasswordResetEmail,
) => Promise<void>;

export interface EmailTransport {
  sendPasswordResetEmail: SendPasswordResetEmail;
}
