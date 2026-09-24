import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/notifications/dal", () => ({
  createNotification: (...args: unknown[]) =>
    mocks.mockCreateNotification(...args),
}));

const mockCreateNotification = mocks.mockCreateNotification;

import { notifyAccountSecurity } from "../events";

const USER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateNotification.mockResolvedValue({ id: "n1" });
});

describe("notifyAccountSecurity", () => {
  it("creates an account_security notification for a password change", async () => {
    await notifyAccountSecurity(USER_ID, "password_changed");

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    const input = mockCreateNotification.mock.calls[0][0];
    expect(input.userId).toBe(USER_ID);
    expect(input.type).toBe("account_security");
    expect(input.actionUrl).toBe("/settings");
    expect(input.data.event).toBe("password_changed");
    expect(input.data.occurredAt).toBeTruthy();
  });

  it("forwards extra event data", async () => {
    await notifyAccountSecurity(USER_ID, "other_sessions_revoked", {
      count: 2,
    });

    const input = mockCreateNotification.mock.calls[0][0];
    expect(input.data.event).toBe("other_sessions_revoked");
    expect(input.data.count).toBe(2);
  });

  it("resolves cleanly when the DAL returns no row", async () => {
    mockCreateNotification.mockResolvedValue(null);

    await expect(
      notifyAccountSecurity(USER_ID, "email_verified"),
    ).resolves.toBeUndefined();
  });
});