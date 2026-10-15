import { describe, it, expect } from "vitest";
import {
  buildVerificationEmail,
  buildEmailChangeVerificationEmail,
} from "@/lib/email/verification";

const BASE_URL = "https://jobs.example.com";

describe("buildVerificationEmail", () => {
  it("builds a well-formed verification email", () => {
    const email = buildVerificationEmail(
      "user@example.com",
      `${BASE_URL}/auth/verify-email?token=abc123`,
    );
    expect(email.to).toBe("user@example.com");
    expect(email.subject).toContain("Verify");
    expect(email.text).toContain(`${BASE_URL}/auth/verify-email?token=abc123`);
    expect(email.html).toContain("Verify your email");
  });

  it("mentions the 24-hour validity window", () => {
    const email = buildVerificationEmail("u@x.com", "https://x.example/v?t=1");
    expect(email.text).toContain("24 hours");
    expect(email.html).toContain("24 hours");
  });

  it("HTML-escapes the verification URL", () => {
    const email = buildVerificationEmail(
      "u@x.com",
      'https://x.example/verify?redirect="evil.com"&x=<script>',
    );
    expect(email.html).toContain("&amp;");
    expect(email.html).toContain("&lt;");
    expect(email.html).toContain("&quot;");
  });

  it("does not contain tokens or secrets in subject", () => {
    const email = buildVerificationEmail("u@x.com", "https://x.example/v?t=topsecret");
    expect(email.subject).not.toContain("topsecret");
  });

  it("includes a safe-ignore sentence", () => {
    const email = buildVerificationEmail("u@x.com", "https://x.example/v?t=1");
    expect(email.text).toContain("ignore");
  });
});

describe("buildEmailChangeVerificationEmail", () => {
  it("builds an email-change verification email", () => {
    const email = buildEmailChangeVerificationEmail(
      "new@example.com",
      `${BASE_URL}/auth/verify-email-change?token=xyz789`,
    );
    expect(email.to).toBe("new@example.com");
    expect(email.subject).toContain("Verify your new email");
    expect(email.text).toContain("change your email address");
    expect(email.text).toContain(`${BASE_URL}/auth/verify-email-change?token=xyz789`);
    expect(email.html).toContain("Verify your new email");
  });

  it("mentions the 24-hour validity window", () => {
    const email = buildEmailChangeVerificationEmail("new@x.com", "https://x.example/v?t=1");
    expect(email.text).toContain("24 hours");
    expect(email.html).toContain("24 hours");
  });

  it("HTML-escapes the verification URL", () => {
    const email = buildEmailChangeVerificationEmail(
      "new@x.com",
      'https://x.example/change?redirect="evil.com"&x=<b>',
    );
    expect(email.html).toContain("&amp;");
    expect(email.html).toContain("&lt;");
    expect(email.html).toContain("&quot;");
  });

  it("does not include the raw token in the subject", () => {
    const email = buildEmailChangeVerificationEmail("new@x.com", "https://x.example/v?t=secrettoken");
    expect(email.subject).not.toContain("secrettoken");
  });

  it("states that the current email remains unchanged", () => {
    const email = buildEmailChangeVerificationEmail("new@x.com", "https://x.example/v?t=1");
    expect(email.text).toContain("remain unchanged");
  });
});
