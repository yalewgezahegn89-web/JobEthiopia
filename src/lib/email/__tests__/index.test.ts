import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dispatchApplicationSubmissionNotification,
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
