import { Resend } from "resend";
import type { EmailTransport, PasswordResetEmail, EmailMessage } from "./types";

export interface ResendTransportConfig {
  apiKey?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Creates a Resend-based email transport. Reads configuration from
 * environment variables by default; explicit config overrides are
 * available for testing.
 *
 * Never logs the API key. Never logs email body content.
 */
export function createResendTransport(
  config?: ResendTransportConfig,
): EmailTransport {
  const apiKey = config?.apiKey ?? process.env.RESEND_API_KEY;
  const from = config?.from ?? process.env.EMAIL_FROM;
  const replyTo = config?.replyTo ?? process.env.EMAIL_REPLY_TO;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required for live email transport");
  }
  if (!from) {
    throw new Error("EMAIL_FROM is required for live email transport");
  }

  const apiKeyResolved = apiKey;
  const fromResolved = from;
  const resend = new Resend(apiKeyResolved);

  async function send(email: EmailMessage): Promise<void> {
    const result = await resend.emails.send({
      from: fromResolved,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }
  }

  return {
    async sendPasswordResetEmail(email: PasswordResetEmail): Promise<void> {
      await send(email);
    },
    async sendEmail(email: EmailMessage): Promise<void> {
      await send(email);
    },
  };
}
