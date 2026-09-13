import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/notifications/dal", () => ({
  createNotification: (...args: unknown[]) => mocks.mockCreateNotification(...args),
}));

import {
  notifyApplicationStatusChanged,
  notifyJobAlertMatch,
} from "@/lib/notifications/events";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyApplicationStatusChanged", () => {
  it("does not notify for SUBMITTED status", async () => {
    await notifyApplicationStatusChanged({
      candidateUserId: "u1",
      applicationId: "a1",
      jobTitle: "Engineer",
      newStatus: "SUBMITTED",
    });
    expect(mocks.mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not notify for WITHDRAWN status", async () => {
    await notifyApplicationStatusChanged({
      candidateUserId: "u1",
      applicationId: "a1",
      jobTitle: "Engineer",
      newStatus: "WITHDRAWN",
    });
    expect(mocks.mockCreateNotification).not.toHaveBeenCalled();
  });

  it("notifies for REVIEWING status", async () => {
    mocks.mockCreateNotification.mockResolvedValue({ id: "1" });

    await notifyApplicationStatusChanged({
      candidateUserId: "u1",
      applicationId: "a1",
      jobTitle: "Engineer",
      newStatus: "REVIEWING",
    });

    expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
      userId: "u1",
      type: "application_status_changed",
      data: { applicationId: "a1", jobTitle: "Engineer", status: "REVIEWING" },
      actionUrl: "/applications/a1",
    });
  });

  it("notifies for SHORTLISTED status", async () => {
    mocks.mockCreateNotification.mockResolvedValue({ id: "1" });

    await notifyApplicationStatusChanged({
      candidateUserId: "u1",
      applicationId: "a1",
      jobTitle: "Engineer",
      newStatus: "SHORTLISTED",
    });

    expect(mocks.mockCreateNotification).toHaveBeenCalled();
  });

  it("notifies for REJECTED status", async () => {
    mocks.mockCreateNotification.mockResolvedValue({ id: "1" });

    await notifyApplicationStatusChanged({
      candidateUserId: "u1",
      applicationId: "a1",
      jobTitle: "Engineer",
      newStatus: "REJECTED",
    });

    expect(mocks.mockCreateNotification).toHaveBeenCalled();
  });

  it("does not throw on dal failure", async () => {
    mocks.mockCreateNotification.mockResolvedValue(null);

    await expect(
      notifyApplicationStatusChanged({
        candidateUserId: "u1",
        applicationId: "a1",
        jobTitle: "Engineer",
        newStatus: "REVIEWING",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("notifyJobAlertMatch", () => {
  it("does not notify when matchCount is 0", async () => {
    await notifyJobAlertMatch({
      userId: "u1",
      alertName: "My Alert",
      matchCount: 0,
    });
    expect(mocks.mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not notify when matchCount is negative", async () => {
    await notifyJobAlertMatch({
      userId: "u1",
      alertName: "My Alert",
      matchCount: -1,
    });
    expect(mocks.mockCreateNotification).not.toHaveBeenCalled();
  });

  it("creates notification for positive matchCount", async () => {
    mocks.mockCreateNotification.mockResolvedValue({ id: "1" });

    await notifyJobAlertMatch({
      userId: "u1",
      alertName: "My Alert",
      matchCount: 3,
    });

    expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
      userId: "u1",
      type: "job_alert_match",
      data: { alertName: "My Alert", matchCount: 3 },
      actionUrl: "/saved-jobs",
    });
  });

  it("does not throw on dal failure", async () => {
    mocks.mockCreateNotification.mockResolvedValue(null);

    await expect(
      notifyJobAlertMatch({
        userId: "u1",
        alertName: "My Alert",
        matchCount: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
