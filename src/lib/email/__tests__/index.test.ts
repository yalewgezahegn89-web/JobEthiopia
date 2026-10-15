import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dispatchApplicationSubmissionNotification,
  dispatchApplicationStatusNotification,
  dispatchJobAlertEmail,
  dispatchEmailVerification,
  dispatchEmailChangeVerification,
  setEmailTransport,
  resetEmailTransport,
} from "@/lib/email";

const NOTIFICATION = {
  candidateName: "Abebe",
  jobTitle: "Software Engineer",
  organizationName: "EthioTech",
  applicationId: "11111111-1111-4111-8111-111111111111",
  submittedAt: "2026-08-31T10:00:00.000Z",
};

describe("dispatchApplicationSubmissionNotification", () => {
  const sendEmail = vi.fn();

  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
    setEmailTransport({ sendPasswordResetEmail: vi.fn(), sendEmail });
  });

  afterEach(() => {
    resetEmailTransport();
    vi.restoreAllMocks();
  });

  it("sends a confirmation to the recipient via the injected transport", async () => {
    await dispatchApplicationSubmissionNotification("candidate@example.com", NOTIFICATION);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe("candidate@example.com");
    expect(email.subject).toContain("Software Engineer");
    expect(email.text).toContain(
      "http://localhost:3000/applications/11111111-1111-4111-8111-111111111111",
    );
  });

  it("never throws on provider failure", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP unreachable"));
    await expect(
      dispatchApplicationSubmissionNotification("candidate@example.com", NOTIFICATION),
    ).resolves.toBeUndefined();
  });

  it("logs email_send_succeeded without the recipient, body, or URL", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await dispatchApplicationSubmissionNotification("candidate@example.com", NOTIFICATION);
    const records = infoSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const ok = records.find((r) => r.event === "email_send_succeeded");
    expect(ok).toBeDefined();
    expect(ok.emailType).toBe("application_submission");
    expect(ok.recipientType).toBe("candidate");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("candidate@example.com");
    expect(raw).not.toContain("/applications/");
    infoSpy.mockRestore();
  });

  it("logs email_send_failed on provider failure without the recipient or URL", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP unreachable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await dispatchApplicationSubmissionNotification("candidate@example.com", NOTIFICATION);
    const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const failed = records.find((r) => r.event === "email_send_failed");
    expect(failed).toBeDefined();
    expect(failed.emailType).toBe("application_submission");
    expect(failed.errorCode).toBe("EMAIL_DISPATCH_FAILED");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("candidate@example.com");
    expect(raw).not.toContain("/applications/");
    errorSpy.mockRestore();
  });
});

const STATUS_NOTIFICATION = {
  applicationId: "11111111-1111-4111-8111-111111111111",
  candidateEmail: "candidate@example.com",
  candidateName: "Abebe",
  jobTitle: "Software Engineer",
  organizationName: "EthioTech",
  newStatus: "REVIEWING" as const,
};

describe("dispatchApplicationStatusNotification", () => {
  const sendEmail = vi.fn();

  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
    setEmailTransport({ sendPasswordResetEmail: vi.fn(), sendEmail });
  });

  afterEach(() => {
    resetEmailTransport();
    vi.restoreAllMocks();
  });

  it("sends a status-change email to the candidate", async () => {
    await dispatchApplicationStatusNotification(STATUS_NOTIFICATION);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe("candidate@example.com");
    expect(email.subject).toContain("REVIEWING");
    expect(email.subject).toContain("Software Engineer");
  });

  it("never throws on provider failure", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP unreachable"));
    await expect(
      dispatchApplicationStatusNotification(STATUS_NOTIFICATION),
    ).resolves.toBeUndefined();
  });

  it("logs email_send_succeeded without the recipient", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await dispatchApplicationStatusNotification(STATUS_NOTIFICATION);
    const records = infoSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const ok = records.find((r) => r.event === "email_send_succeeded");
    expect(ok).toBeDefined();
    expect(ok.emailType).toBe("application_status");
    expect(ok.recipientType).toBe("candidate");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("candidate@example.com");
    infoSpy.mockRestore();
  });

  it("logs email_send_failed on provider failure without the recipient", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP unreachable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await dispatchApplicationStatusNotification(STATUS_NOTIFICATION);
    const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const failed = records.find((r) => r.event === "email_send_failed");
    expect(failed).toBeDefined();
    expect(failed.emailType).toBe("application_status");
    expect(failed.errorCode).toBe("EMAIL_DISPATCH_FAILED");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("candidate@example.com");
    errorSpy.mockRestore();
  });
});

describe("dispatchJobAlertEmail", () => {
  const sendEmail = vi.fn();

  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
    setEmailTransport({ sendPasswordResetEmail: vi.fn(), sendEmail });
  });

  afterEach(() => {
    resetEmailTransport();
    vi.restoreAllMocks();
  });

  it("returns true and sends the email on success", async () => {
    const result = await dispatchJobAlertEmail("user@example.com", "en", {
      alertName: "Auditor roles",
      keywords: "auditor",
      jobs: [],
      baseUrl: "https://app.example.com",
      unsubscribeUrl: "https://app.example.com/unsub?token=abc&locale=en",
    });
    expect(result).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe("user@example.com");
    expect(email.subject).toContain("Auditor roles");
  });

  it("returns false on provider failure without throwing", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    const result = await dispatchJobAlertEmail("user@example.com", "en", {
      alertName: "Alert",
      keywords: null,
      jobs: [],
      baseUrl: "https://app.example.com",
      unsubscribeUrl: "https://app.example.com/unsub?token=abc&locale=en",
    });
    expect(result).toBe(false);
  });

  it("logs email_send_failed on failure without the recipient", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await dispatchJobAlertEmail("user@example.com", "en", {
      alertName: "Alert",
      keywords: null,
      jobs: [],
      baseUrl: "https://app.example.com",
      unsubscribeUrl: "https://app.example.com/unsub?token=abc&locale=en",
    });
    const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const failed = records.find((r) => r.event === "email_send_failed");
    expect(failed).toBeDefined();
    expect(failed.emailType).toBe("job_alert");
    expect(failed.errorCode).toBe("EMAIL_DISPATCH_FAILED");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("user@example.com");
    errorSpy.mockRestore();
  });
});

describe("dispatchEmailVerification", () => {
  const sendEmail = vi.fn();

  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
    setEmailTransport({ sendPasswordResetEmail: vi.fn(), sendEmail });
  });

  afterEach(() => {
    resetEmailTransport();
    vi.restoreAllMocks();
  });

  it("sends a verification email to the user", async () => {
    await dispatchEmailVerification(
      "user@example.com",
      "https://app.example.com/verify?token=abc123",
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe("user@example.com");
    expect(email.subject).toContain("Verify");
    expect(email.text).toContain("https://app.example.com/verify?token=abc123");
  });

  it("never throws on provider failure", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    await expect(
      dispatchEmailVerification("user@example.com", "https://app.example.com/verify?token=abc"),
    ).resolves.toBeUndefined();
  });

  it("logs email_send_succeeded without the recipient", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await dispatchEmailVerification("user@example.com", "https://app.example.com/verify?token=abc");
    const records = infoSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const ok = records.find((r) => r.event === "email_send_succeeded");
    expect(ok).toBeDefined();
    expect(ok.emailType).toBe("email_verification");
    expect(ok.recipientType).toBe("user");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("user@example.com");
    infoSpy.mockRestore();
  });

  it("logs email_send_failed on failure without the recipient or URL", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await dispatchEmailVerification("user@example.com", "https://app.example.com/verify?token=topsecret");
    const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const failed = records.find((r) => r.event === "email_send_failed");
    expect(failed).toBeDefined();
    expect(failed.emailType).toBe("email_verification");
    expect(failed.errorCode).toBe("EMAIL_DISPATCH_FAILED");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("user@example.com");
    expect(raw).not.toContain("topsecret");
    errorSpy.mockRestore();
  });
});

describe("dispatchEmailChangeVerification", () => {
  const sendEmail = vi.fn();

  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
    setEmailTransport({ sendPasswordResetEmail: vi.fn(), sendEmail });
  });

  afterEach(() => {
    resetEmailTransport();
    vi.restoreAllMocks();
  });

  it("sends an email-change verification email", async () => {
    await dispatchEmailChangeVerification(
      "new@example.com",
      "https://app.example.com/verify-email-change?token=xyz",
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe("new@example.com");
    expect(email.subject).toContain("Verify");
    expect(email.text).toContain("https://app.example.com/verify-email-change?token=xyz");
  });

  it("never throws on provider failure", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    await expect(
      dispatchEmailChangeVerification("new@example.com", "https://app.example.com/verify-email-change?token=xyz"),
    ).resolves.toBeUndefined();
  });

  it("logs email_send_failed on failure without the recipient or URL", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await dispatchEmailChangeVerification("new@example.com", "https://app.example.com/verify-email-change?token=secret");
    const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    const failed = records.find((r) => r.event === "email_send_failed");
    expect(failed).toBeDefined();
    expect(failed.emailType).toBe("email_change_verification");
    expect(failed.errorCode).toBe("EMAIL_DISPATCH_FAILED");
    const raw = JSON.stringify(records);
    expect(raw).not.toContain("new@example.com");
    expect(raw).not.toContain("secret");
    errorSpy.mockRestore();
  });
});
